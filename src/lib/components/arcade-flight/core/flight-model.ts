// =====================================================================
//  FLIGHT MODEL — rate-command + G-limit + AoA-limit, engine-agnostic.
//  Hệ toạ độ lõi: X = phải, Y = lên, Z = trước.
// =====================================================================
import {
	D2R,
	FWD,
	G,
	R2D,
	RIGHT,
	UP,
	add,
	clamp,
	clamp01,
	cross,
	dot,
	evalCurve,
	len,
	lerp,
	mul,
	norm,
	qAxisAngle,
	qConj,
	qMul,
	qNorm,
	qRotate,
	sub,
	v3,
	type Quat,
	type Vec3,
} from './math'
import type { AircraftConfig, ControlCmd, FlightState, Modifiers } from './types'

export const DEFAULT_MODS = (): Modifiers => ({
	gScale: 1,
	rateScale: 1,
	aoaLimit: undefined,
	stabilityScale: 1,
	gripScale: 1,
	extraDrag: 0,
	tvc: 0,
	accelScale: 1,
	velAlign: 0,
	rateOverride: null,
	overrideWeight: 0,
})

/** Góc nghiêng cánh, rad; + = nghiêng phải */
export function bankAngle(rot: Quat) {
	const r = qRotate(rot, RIGHT)
	const u = qRotate(rot, UP)
	return Math.atan2(-r.y, u.y)
}

/** AoA cần để lực nâng gánh đúng 1g ở tốc độ V */
export function trimAoA(c: AircraftConfig, V: number) {
	return clamp((c.speed.stall / V) ** 2, 0, 1) * c.aoa.critical * D2R
}

export function createState(
	c: AircraftConfig,
	pos: Vec3,
	headingDeg = 0,
	speed?: number
): FlightState {
	const V = speed ?? c.speed.cruise
	const yaw = qAxisAngle(UP, headingDeg * D2R)
	const pitch = qAxisAngle(RIGHT, -trimAoA(c, V)) // ngẩng mũi đúng AoA cân bằng
	return {
		pos: { ...pos },
		vel: mul(qRotate(yaw, FWD), V),
		rot: qMul(yaw, pitch),
		angVel: v3(),
		throttle: c.cruiseThrottle ?? 0.6,
		ab: 0,
		aoa: 0,
		beta: 0,
		speed: V,
		gLoad: 1,
		stalled: false,
	}
}

export const cloneState = (s: FlightState): FlightState => ({
	...s,
	pos: { ...s.pos },
	vel: { ...s.vel },
	rot: { ...s.rot },
	angVel: { ...s.angVel },
})

/** CL chuẩn hoá: = 1 tại α tới hạn, sụt dần sau stall */
export function clNorm(aDeg: number, crit: number) {
	const a = Math.abs(aDeg)
	const s = Math.sign(aDeg)
	if (a <= crit) return (s * a) / crit
	if (a <= crit + 15) return s * (1 - (0.4 * (a - crit)) / 15)
	if (a >= 90) return 0
	return s * 0.6 * Math.max(0, Math.cos((((a - crit - 15) / (90 - crit - 15)) * Math.PI) / 2))
}

/** Một bước tích phân (mutate `s`). */
export function stepFlight(
	s: FlightState,
	c: AircraftConfig,
	cmd: ControlCmd,
	m: Modifiers,
	dt: number
) {
	const vL = qRotate(qConj(s.rot), s.vel)
	const V = Math.max(len(s.vel), 0.1)
	s.speed = V
	s.aoa = Math.atan2(-vL.y, vL.z)
	s.beta = Math.atan2(vL.x, vL.z)

	// throttle + afterburner spool
	s.throttle += clamp(cmd.throttle - s.throttle, -c.throttleRate * dt, c.throttleRate * dt)
	const abOn = cmd.afterburner && c.afterburnerTWR && s.throttle > 0.9 ? 1 : 0
	s.ab += clamp(abOn - s.ab, -3 * dt, 2 * dt)

	// lệnh tốc độ quay: curve ∩ G-limit ∩ AoA-limit
	const pMax = evalCurve(c.rates.pitch, V) * D2R * m.rateScale
	const rMax = evalCurve(c.rates.roll, V) * D2R * m.rateScale
	const yMax = evalCurve(c.rates.yaw, V) * D2R * m.rateScale
	// n = V·ω/g + cos(·): trừ phần 1g trọng lực đang gánh để G thực không vượt limit
	const upY = qRotate(s.rot, UP).y
	const nLim =
		cmd.pitch >= 0
			? Math.max(0.3, c.gLimit.pos * m.gScale - upY)
			: Math.max(0.3, c.gLimit.neg * m.gScale + upY)
	let q = cmd.pitch * Math.min(pMax, (nLim * G) / V)
	const aLim = (m.aoaLimit ?? c.aoa.limiter) * D2R
	const soft = c.aoa.softZone * D2R
	q *= q > 0 ? clamp01((aLim - s.aoa) / soft) : clamp01((aLim + s.aoa) / soft)
	const stab = c.stability * m.stabilityScale
	const crit = c.aoa.critical * D2R
	// stall → mũi tự rớt
	const stallPush = Math.abs(s.aoa) > crit ? (s.aoa - Math.sign(s.aoa) * crit) * 2.5 * stab : 0
	s.stalled = Math.abs(s.aoa) > crit + 2 * D2R
	let target = v3(-q + stallPush, cmd.yaw * yMax + stab * s.beta, -cmd.roll * rMax)
	if (m.rateOverride && m.overrideWeight > 0) {
		const w = m.overrideWeight
		const o = m.rateOverride
		target = v3(
			o.x !== undefined ? lerp(target.x, o.x, w) : target.x,
			o.y !== undefined ? lerp(target.y, o.y, w) : target.y,
			o.z !== undefined ? lerp(target.z, o.z, w) : target.z
		)
	}

	// rate controller (angularAccel = "quán tính"), thẩm quyền giảm khi chậm, TVC là mức sàn
	const auth = Math.max(clamp(V / c.speed.stall, 0.25, 1), m.tvc)
	const k = D2R * auth * dt * m.accelScale
	const st = (cur: number, tgt: number, a: number) => cur + clamp(tgt - cur, -a * k, a * k)
	s.angVel = v3(
		st(s.angVel.x, target.x, c.angularAccel.pitch),
		st(s.angVel.y, target.y, c.angularAccel.yaw),
		st(s.angVel.z, target.z, c.angularAccel.roll)
	)

	const w = len(s.angVel)
	if (w > 1e-6) s.rot = qNorm(qMul(s.rot, qAxisAngle(mul(s.angVel, 1 / w), w * dt)))

	// lực → gia tốc (chuẩn hoá theo khối lượng)
	const fwd = qRotate(s.rot, FWD)
	const right = qRotate(s.rot, RIGHT)
	const up = qRotate(s.rot, UP)
	const twrMil = c.thrustToWeight
	const twrAB = c.afterburnerTWR || twrMil
	let a = mul(fwd, G * (s.throttle * twrMil + s.ab * (twrAB - twrMil)))
	const vYZ = sub(s.vel, mul(right, dot(s.vel, right)))
	const vyz = len(vYZ)
	const cl = clNorm(s.aoa * R2D, c.aoa.critical)
	const liftMag = cl * G * (vyz / c.speed.stall) ** 2
	a = add(a, mul(norm(cross(norm(vYZ), right)), liftMag))
	const k0 = (twrMil * G) / c.speed.max ** 2
	const dragCoef =
		k0 * (1 + c.bodyDrag * Math.sin(s.aoa) ** 2 + m.extraDrag + (cmd.brake ? c.airbrakeDrag : 0))
	const dragMag = dragCoef * V * V + c.inducedDrag * Math.abs(liftMag) * Math.abs(cl)
	a = add(a, mul(norm(s.vel), -dragMag))
	s.gLoad = dot(a, up) / G
	a = add(a, v3(0, -G, 0))

	s.vel = add(s.vel, mul(a, dt))
	const lat = dot(s.vel, right)
	s.vel = sub(s.vel, mul(right, lat * (1 - Math.exp(-c.sideslipGrip * m.gripScale * dt))))
	if (m.velAlign > 0) {
		// fake arcade: hướng bay bám theo mũi (dùng cho J-turn)
		const sp = len(s.vel)
		const t = 1 - Math.exp(-m.velAlign * dt)
		s.vel = mul(norm(add(mul(norm(s.vel), 1 - t), mul(fwd, t))), sp)
	}
	s.pos = add(s.pos, mul(s.vel, dt))
}

/** Bán kính vòng nhào lộn ở tốc độ hiện tại (giới hạn bởi rate curve và G) */
export function loopRadius(s: FlightState, c: AircraftConfig) {
	const pMax = evalCurve(c.rates.pitch, s.speed) * D2R
	const w = Math.min(pMax, (c.gLimit.pos * G) / s.speed)
	return s.speed / w
}

/** Thông số suy ra để designer kiểm tra config có nhất quán không (m/s) */
export function derived(c: AircraftConfig) {
	let cornerFromCurve: number | null = null
	// V nhỏ nhất mà G-limit cắt curve
	for (let V = c.speed.min; V < c.speed.max * 1.5; V += 1)
		if ((c.gLimit.pos * G) / V <= evalCurve(c.rates.pitch, V) * D2R) {
			cornerFromCurve = V
			break
		}
	return {
		cornerFromCurve,
		cornerFromLift: c.speed.stall * Math.sqrt(c.gLimit.pos),
		vMaxAB: c.afterburnerTWR ? c.speed.max * Math.sqrt(c.afterburnerTWR / c.thrustToWeight) : null,
	}
}
