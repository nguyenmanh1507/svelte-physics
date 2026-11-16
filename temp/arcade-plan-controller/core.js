// =====================================================================
//  FLIGHT CORE — engine-agnostic (không import gì từ Three.js / Unity)
//  Hệ toạ độ lõi: X = phải, Y = lên, Z = trước (giống Unity).
//  Quy ước: ω_x > 0 chúi mũi, ω_y > 0 mũi sang phải, ω_z > 0 roll trái.
// =====================================================================
;(function (root) {
	'use strict'

	// ---------------- math ----------------
	const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z })
	const add = (a, b) => v3(a.x + b.x, a.y + b.y, a.z + b.z)
	const sub = (a, b) => v3(a.x - b.x, a.y - b.y, a.z - b.z)
	const mul = (a, s) => v3(a.x * s, a.y * s, a.z * s)
	const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z
	const cross = (a, b) => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x)
	const len = (a) => Math.hypot(a.x, a.y, a.z)
	const norm = (a) => {
		const l = len(a)
		return l > 1e-9 ? mul(a, 1 / l) : v3()
	}
	const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x))
	const clamp01 = (x) => clamp(x, 0, 1)
	const lerp = (a, b, t) => a + (b - a) * t
	const qMul = (a, b) => ({
		w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
		x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
		y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
		z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
	})
	const qConj = (q) => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w })
	const qNorm = (q) => {
		const l = Math.hypot(q.x, q.y, q.z, q.w)
		return { x: q.x / l, y: q.y / l, z: q.z / l, w: q.w / l }
	}
	const qAxisAngle = (axis, ang) => {
		const s = Math.sin(ang / 2)
		return { x: axis.x * s, y: axis.y * s, z: axis.z * s, w: Math.cos(ang / 2) }
	}
	const qRotate = (q, p) => {
		const r = qMul(qMul(q, { x: p.x, y: p.y, z: p.z, w: 0 }), qConj(q))
		return v3(r.x, r.y, r.z)
	}
	const qIdent = () => ({ x: 0, y: 0, z: 0, w: 1 })
	const FWD = v3(0, 0, 1),
		RIGHT = v3(1, 0, 0),
		UP = v3(0, 1, 0)
	const G = 9.81,
		D2R = Math.PI / 180,
		R2D = 180 / Math.PI
	const ease = (u) => {
		u = clamp01(u)
		return u * u * (3 - 2 * u)
	}

	// Quaternion chỉ có yaw (heading) từ một vector forward
	function qYawFrom(fwd) {
		const h = Math.atan2(fwd.x, fwd.z)
		return qAxisAngle(UP, h)
	}
	// Sai số hướng (body frame) → vector trục*góc
	function attitudeError(cur, target) {
		let e = qMul(qConj(cur), target)
		if (e.w < 0) e = { x: -e.x, y: -e.y, z: -e.z, w: -e.w }
		const s = Math.sqrt(Math.max(1e-12, 1 - e.w * e.w))
		const ang = 2 * Math.acos(clamp(e.w, -1, 1))
		return s < 1e-6 ? v3() : v3((e.x / s) * ang, (e.y / s) * ang, (e.z / s) * ang)
	}

	// ---------------- curve ----------------
	function evalCurve(c, x) {
		if (x <= c[0][0]) return c[0][1]
		for (let i = 1; i < c.length; i++)
			if (x <= c[i][0]) {
				const [x0, y0] = c[i - 1],
					[x1, y1] = c[i]
				return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
			}
		return c[c.length - 1][1]
	}

	// ---------------- state / modifiers ----------------
	const DEFAULT_MODS = () => ({
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

	function bankAngle(rot) {
		const r = qRotate(rot, RIGHT),
			u = qRotate(rot, UP)
		return Math.atan2(-r.y, u.y)
	} // + = nghiêng phải

	function trimAoA(c, V) {
		return clamp((c.speed.stall / V) ** 2, 0, 1) * c.aoa.critical * D2R
	}

	function createState(c, pos, headingDeg = 0, speed) {
		const V = speed ?? c.speed.cruise
		const yaw = qAxisAngle(UP, headingDeg * D2R)
		const pitch = qAxisAngle(RIGHT, -trimAoA(c, V)) // ngẩng mũi đúng AoA cân bằng
		const rot = qMul(yaw, pitch)
		return {
			pos: { ...pos },
			vel: mul(qRotate(yaw, FWD), V),
			rot,
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
	const cloneState = (s) => ({
		...s,
		pos: { ...s.pos },
		vel: { ...s.vel },
		rot: { ...s.rot },
		angVel: { ...s.angVel },
	})

	function clNorm(aDeg, crit) {
		// CL chuẩn hoá: =1 tại α tới hạn
		const a = Math.abs(aDeg),
			s = Math.sign(aDeg)
		if (a <= crit) return (s * a) / crit
		if (a <= crit + 15) return s * (1 - (0.4 * (a - crit)) / 15)
		if (a >= 90) return 0
		return s * 0.6 * Math.max(0, Math.cos((((a - crit - 15) / (90 - crit - 15)) * Math.PI) / 2))
	}

	// ---------------- flight step ----------------
	function stepFlight(s, c, cmd, m, dt) {
		const inv = qConj(s.rot),
			vL = qRotate(inv, s.vel)
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
		const aLim = (m.aoaLimit ?? c.aoa.limiter) * D2R,
			soft = c.aoa.softZone * D2R
		q *= q > 0 ? clamp01((aLim - s.aoa) / soft) : clamp01((aLim + s.aoa) / soft)
		const stab = c.stability * m.stabilityScale,
			crit = c.aoa.critical * D2R
		const stallPush = Math.abs(s.aoa) > crit ? (s.aoa - Math.sign(s.aoa) * crit) * 2.5 * stab : 0 // stall → mũi tự rớt
		s.stalled = Math.abs(s.aoa) > crit + 2 * D2R
		let target = v3(-q + stallPush, cmd.yaw * yMax + stab * s.beta, -cmd.roll * rMax)
		if (m.rateOverride && m.overrideWeight > 0) {
			const w = m.overrideWeight,
				o = m.rateOverride
			target = v3(
				o.x !== undefined ? lerp(target.x, o.x, w) : target.x,
				o.y !== undefined ? lerp(target.y, o.y, w) : target.y,
				o.z !== undefined ? lerp(target.z, o.z, w) : target.z
			)
		}

		// rate controller (angularAccel = "quán tính"), thẩm quyền giảm khi chậm, TVC là mức sàn
		const auth = Math.max(clamp(V / c.speed.stall, 0.25, 1), m.tvc)
		const k = D2R * auth * dt * m.accelScale
		const st = (cur, tgt, a) => cur + clamp(tgt - cur, -a * k, a * k)
		s.angVel = v3(
			st(s.angVel.x, target.x, c.angularAccel.pitch),
			st(s.angVel.y, target.y, c.angularAccel.yaw),
			st(s.angVel.z, target.z, c.angularAccel.roll)
		)

		const w = len(s.angVel)
		if (w > 1e-6) s.rot = qNorm(qMul(s.rot, qAxisAngle(mul(s.angVel, 1 / w), w * dt)))

		// lực → gia tốc (chuẩn hoá theo khối lượng)
		const fwd = qRotate(s.rot, FWD),
			right = qRotate(s.rot, RIGHT),
			up = qRotate(s.rot, UP)
		const twrMil = c.thrustToWeight,
			twrAB = c.afterburnerTWR || twrMil
		let a = mul(fwd, G * (s.throttle * twrMil + s.ab * (twrAB - twrMil)))
		const vYZ = sub(s.vel, mul(right, dot(s.vel, right)))
		const vyz = len(vYZ),
			cl = clNorm(s.aoa * R2D, c.aoa.critical)
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
			const sp = len(s.vel),
				t = 1 - Math.exp(-m.velAlign * dt)
			s.vel = mul(norm(add(mul(norm(s.vel), 1 - t), mul(fwd, t))), sp)
		}
		s.pos = add(s.pos, mul(s.vel, dt))
	}

	// ---------------- input helpers ----------------
	function scaledRadial(x, y, inner, outer = 0.98) {
		const m = Math.hypot(x, y)
		if (m < inner) return [0, 0]
		const k = clamp01((m - inner) / (outer - inner)) / m
		return [x * k, y * k]
	}
	const expo = (x, e) => Math.sign(x) * ((1 - e) * Math.abs(x) + e * Math.abs(x) ** 3)
	class Smoother {
		constructor() {
			this.v = 0
		}
		update(t, dt, tau) {
			this.v += (t - this.v) * (1 - Math.exp(-dt / Math.max(tau, 1e-4)))
			return this.v
		}
	}
	class KeyAxis {
		constructor(rise = 4, fall = 7) {
			this.v = 0
			this.rise = rise
			this.fall = fall
		}
		update(neg, pos, dt) {
			const t = (pos ? 1 : 0) - (neg ? 1 : 0)
			const r = t === 0 || Math.sign(t) !== Math.sign(this.v) ? this.fall : this.rise
			this.v += clamp(t - this.v, -r * dt, r * dt)
			return this.v
		}
	}

	// InputBuffer: nhận sự kiện có timestamp, phát hiện chord / double-tap / hold
	class InputBuffer {
		constructor(opt = {}) {
			this.chordWindow = opt.chordWindow ?? 0.09
			this.doubleWindow = opt.doubleWindow ?? 0.26
			this.chords = opt.chords ?? []
			this.down = new Map()
			this.lastPress = new Map()
			this.queue = []
			this.log = []
		}
		press(a, t) {
			if (this.down.has(a)) return
			this.down.set(a, t)
			const prev = this.lastPress.get(a)
			if (prev !== undefined && t - prev <= this.doubleWindow) {
				this.emit({ type: 'double', a, t, gap: t - prev })
				this.lastPress.delete(a)
			} else this.lastPress.set(a, t)
			this.emit({ type: 'press', a, t })
			for (const ch of this.chords)
				if (ch.keys.includes(a)) {
					const times = ch.keys.map((k) => this.down.get(k))
					if (times.every((x) => x !== undefined)) {
						const spread = Math.max(...times) - Math.min(...times)
						if (spread <= this.chordWindow) this.emit({ type: 'chord', a: ch.name, t, gap: spread })
					}
				}
		}
		release(a, t) {
			const t0 = this.down.get(a)
			if (t0 === undefined) return
			this.down.delete(a)
			this.emit({ type: 'release', a, t, held: t - t0 })
		}
		isDown(a) {
			return this.down.has(a)
		}
		heldFor(a, now) {
			const t0 = this.down.get(a)
			return t0 === undefined ? 0 : now - t0
		}
		emit(e) {
			this.queue.push(e)
			if (e.type !== 'press' && e.type !== 'release') {
				this.log.unshift(e)
				this.log.length = Math.min(this.log.length, 6)
			}
		}
		drain() {
			const q = this.queue
			this.queue = []
			return q
		}
	}

	// ---------------- PID + modes ----------------
	class PID {
		constructor(kp, ki, kd, iMax = 0.5) {
			this.kp = kp
			this.ki = ki
			this.kd = kd
			this.iMax = iMax
			this.i = 0
		}
		reset() {
			this.i = 0
		}
		update(err, rate, dt) {
			this.i = clamp(this.i + err * dt, -this.iMax, this.iMax)
			return this.kp * err + this.ki * this.i - this.kd * rate
		}
	}

	class MouseAimAutopilot {
		constructor() {
			this.pitchPid = new PID(3.2, 0.3, 0.55)
			this.yawPid = new PID(2.0, 0, 0.3)
			this.rollPid = new PID(2.6, 0, 0.35)
			this.aggressiveTurnAngle = 10 * D2R
		}
		reset() {
			this.pitchPid.reset()
			this.yawPid.reset()
			this.rollPid.reset()
		}
		update(aimDir, s, c, dt) {
			const d = qRotate(qConj(s.rot), norm(aimDir))
			const off = Math.acos(clamp(d.z, -1, 1))
			const pitchErr = Math.atan2(d.y, Math.max(d.z, 0.05)),
				yawErr = Math.atan2(d.x, Math.max(d.z, 0.05))
			const aggressive = clamp(Math.atan2(d.x, d.y), -Math.PI / 2, Math.PI / 2)
			const level = -bankAngle(s.rot)
			const wv = clamp01(off / this.aggressiveTurnAngle)
			const rollErr = lerp(level, aggressive, wv)
			// tỉ lệ gain theo độ nhanh nhẹn của máy bay để cùng 1 bộ PID dùng cho mọi loại
			const rRate = evalCurve(c.rates.roll, s.speed) * D2R,
				pRate = evalCurve(c.rates.pitch, s.speed) * D2R
			const rs = clamp(1.5 / rRate, 0.15, 3),
				ps = clamp(0.5 / pRate, 0.5, 4)
			return {
				pitch:
					d.z < 0 ? 1 : clamp(this.pitchPid.update(pitchErr * ps, -s.angVel.x * ps, dt), -1, 1),
				yaw: clamp(this.yawPid.update(yawErr, s.angVel.y, dt), -1, 1),
				roll: clamp(this.rollPid.update(rollErr * rs, -s.angVel.z * rs, dt), -1, 1),
			}
		}
	}

	// ---------------- maneuvers ----------------
	class HighG {
		constructor() {
			this.id = 'highG'
			this.name = 'HIGH-G TURN'
			this.blendIn = 0.15
			this.blendOut = 0.3
		}
		canStart({ s, c }) {
			return s.speed > c.speed.stall * 1.3
		}
		begin() {}
		update({ s, c, p, input }) {
			const done =
				!(input.boost && input.brake) ||
				Math.abs(input.stickPitch) < 0.2 ||
				s.speed < c.speed.stall * 1.1
			return {
				mods: {
					gScale: p.gScale,
					rateScale: p.rateScale,
					extraDrag: p.extraDrag,
					aoaLimit: c.aoa.limiter + (p.aoaBonus ?? 6),
				},
				done,
			}
		}
	}

	// Cobra (curve AoA mục tiêu), tự nâng cấp lên Kulbit nếu tiếp tục giữ kéo
	class PostStall {
		constructor(kind) {
			this.kind = kind
			this.id = kind
			this.blendIn = 0.08
			this.blendOut = 0.7
		}
		get name() {
			return this.mode === 'kulbit' ? 'KULBIT' : 'COBRA'
		}
		canStart({ s, c, agl, p }) {
			if (!p) return 'Máy bay không hỗ trợ'
			if (s.speed < p.speedMin || s.speed > p.speedMax)
				return `Cần tốc độ ${Math.round(p.speedMin * 3.6)}–${Math.round(p.speedMax * 3.6)} km/h`
			if (agl < p.minAGL) return `Cần độ cao > ${p.minAGL} m`
			if (Math.abs(bankAngle(s.rot)) > 35 * D2R) return 'Cần cánh gần cân bằng'
			return true
		}
		begin({ allMan }) {
			this.t = 0
			this.theta = 0
			this.mode = this.kind
			this.kulbitP = allMan.kulbit
			this.cobraP = allMan.cobra
		}
		update({ s, c, input, agl }, dt) {
			this.t += dt
			this.theta += -s.angVel.x * dt
			const mods = { aoaLimit: 180, stabilityScale: 0, gripScale: 0, tvc: 1, accelScale: 4 }
			if (this.mode === 'cobra') {
				const p = this.cobraP,
					u = clamp01(this.t / p.duration)
				const aoaT = p.peakAoA * D2R * Math.sin(Math.PI * u)
				const rate = clamp(5 * (aoaT - s.aoa), -2.6, 2.6)
				if (
					this.kulbitP &&
					this.t > 0.6 &&
					this.t < 1.0 &&
					input.stickPitch > 0.5 &&
					agl > this.kulbitP.minAGL &&
					(!this.kulbitP.requiresTVC || c.thrustVectoring)
				) {
					this.mode = 'kulbit'
					this.t0 = this.t
					this.th0 = this.theta
				}
				mods.extraDrag = p.extraDrag ?? 20
				mods.rateOverride = v3(-rate, 0, 0)
				return { mods, done: (u >= 1 && s.aoa < 15 * D2R) || this.t > p.duration + 1.5 }
			}
			const p = this.kulbitP,
				T = p.duration,
				uk = (this.t - this.t0) / T
			const span = 2 * Math.PI - this.th0
			const thT = this.th0 + span * ease(uk)
			const ff = uk < 1 ? (span * 6 * clamp01(uk) * (1 - clamp01(uk))) / T : 0 // đạo hàm smoothstep
			const rate = clamp(ff + 5 * (thT - this.theta), -0.5, 4.5)
			mods.extraDrag = p.extraDrag ?? 20
			mods.rateOverride = v3(-rate, 0, 0)
			return { mods, done: (uk >= 1 && this.theta > 2 * Math.PI - 0.2) || uk > 1.7 }
		}
	}

	// Herbst / J-turn: chuỗi hướng mục tiêu tương đối khung lúc vào + attitude controller
	class JTurn {
		constructor() {
			this.id = 'jTurn'
			this.name = 'HERBST / J-TURN'
			this.blendIn = 0.1
			this.blendOut = 0.7
		}
		canStart({ s, c, agl, p }) {
			if (!p) return 'Máy bay không hỗ trợ'
			if (p.requiresTVC && !c.thrustVectoring) return 'Cần thrust vectoring'
			if (s.speed < p.speedMin || s.speed > p.speedMax)
				return `Cần tốc độ ${Math.round(p.speedMin * 3.6)}–${Math.round(p.speedMax * 3.6)} km/h`
			if (agl < p.minAGL) return `Cần độ cao > ${p.minAGL} m`
			return true
		}
		begin({ s, dir }) {
			this.t = 0
			this.E = qYawFrom(qRotate(s.rot, FWD))
			this.dir = dir || 1
		}
		update({ s, p }, dt) {
			this.t += dt
			const u = clamp01(this.t / p.duration)
			let th, psi
			if (u < 0.3) {
				th = 75 * ease(u / 0.3)
				psi = 0
			} else if (u < 0.7) {
				th = 75
				psi = 180 * ease((u - 0.3) / 0.4)
			} else {
				th = lerp(75, -12, ease((u - 0.7) / 0.3))
				psi = 180
			}
			const qT = qMul(
				qMul(this.E, qAxisAngle(UP, this.dir * psi * D2R)),
				qAxisAngle(RIGHT, -th * D2R)
			)
			let w = mul(attitudeError(s.rot, qT), 4.5)
			const wl = len(w)
			if (wl > 3.2) w = mul(w, 3.2 / wl)
			return {
				mods: {
					rateOverride: w,
					aoaLimit: 180,
					stabilityScale: 0,
					gripScale: 0,
					tvc: 1,
					accelScale: 4,
					velAlign: u > 0.15 ? 1.4 : 0.3,
					extraDrag: 12,
				},
				cmd: { throttle: u < 0.7 ? 0.4 : 1, afterburner: u >= 0.7 },
				done: u >= 1,
			}
		}
	}

	function loopRadius(s, c) {
		const pMax = evalCurve(c.rates.pitch, s.speed) * D2R,
			w = Math.min(pMax, (c.gLimit.pos * G) / s.speed)
		return s.speed / w
	}

	// Split-S: roll ngửa → kéo hết cỡ tới khi đảo hướng (quay 180° bổ nhào)
	class SplitS {
		constructor() {
			this.id = 'splitS'
			this.name = 'SPLIT-S'
			this.blendIn = 0.1
			this.blendOut = 0.4
		}
		canStart({ s, c, agl, p }) {
			if (!p) return 'Máy bay không hỗ trợ'
			const need = 2 * loopRadius(s, c) * (p.altitudeMargin ?? 1.3)
			return agl > need ? true : `Không đủ độ cao (cần ~${Math.round(need)} m)`
		}
		begin({ s }) {
			this.phase = 0
			this.t = 0
			this.entryFwd = qRotate(s.rot, FWD)
			this.dir = bankAngle(s.rot) >= 0 ? 1 : -1
		}
		update({ s, p }, dt) {
			this.t += dt
			const fwd = qRotate(s.rot, FWD)
			if (this.phase === 0) {
				if (Math.abs(bankAngle(s.rot)) > 165 * D2R) this.phase = 1
				return { cmd: { roll: this.dir, pitch: 0, yaw: 0 }, done: this.t > 4 }
			}
			const done = (dot(fwd, this.entryFwd) < -0.8 && fwd.y > -0.2) || this.t > 9
			return {
				cmd: done ? { pitch: 0, roll: 0 } : { pitch: 1, roll: 0, yaw: 0, throttle: 0.2 },
				mods: { gScale: p.gScale ?? 1.25, rateScale: p.rateScale ?? 1.4 },
				done,
			}
		}
	}

	// Immelmann: kéo nửa vòng lên → roll 180° khi đã ngửa
	class Immelmann {
		constructor() {
			this.id = 'immelmann'
			this.name = 'IMMELMANN'
			this.blendIn = 0.1
			this.blendOut = 0.4
		}
		canStart({ s, c, p }) {
			if (!p) return 'Máy bay không hỗ trợ'
			const R = loopRadius(s, c),
				need = c.speed.min ** 2 + 2 * G * 2 * R * 0.6
			return s.speed ** 2 > need
				? true
				: `Không đủ năng lượng (cần ~${Math.round(Math.sqrt(need) * 3.6)} km/h)`
		}
		begin({ s }) {
			this.phase = 0
			this.t = 0
			this.entryFwd = qRotate(s.rot, FWD)
		}
		update({ s, p }, dt) {
			this.t += dt
			const fwd = qRotate(s.rot, FWD),
				up = qRotate(s.rot, UP)
			if (this.phase === 0) {
				if (dot(fwd, this.entryFwd) < -0.7 && up.y < 0 && fwd.y < 0.35) this.phase = 1
				return {
					cmd: { pitch: 1, roll: 0, yaw: 0 },
					mods: { gScale: p.gScale ?? 1.25, rateScale: p.rateScale ?? 1.4 },
					done: this.t > 9,
				}
			}
			const done = Math.abs(bankAngle(s.rot)) < 12 * D2R || this.t > 12
			return { cmd: { pitch: 0, roll: done ? 0 : 1, yaw: 0 }, done }
		}
	}

	class BarrelRoll {
		constructor() {
			this.id = 'barrelRoll'
			this.name = 'BARREL ROLL'
			this.blendIn = 0.08
			this.blendOut = 0.3
		}
		canStart({ p }) {
			return p ? true : 'Máy bay không hỗ trợ'
		}
		begin({ dir }) {
			this.t = 0
			this.rolled = 0
			this.dir = dir
		}
		update({ s, p }, dt) {
			this.t += dt
			this.rolled += Math.abs(s.angVel.z) * dt
			const done = this.rolled >= 2 * Math.PI - 0.1 || this.t > p.duration * 1.6
			return {
				cmd: done ? { roll: 0, pitch: 0 } : { roll: this.dir * 0.9, pitch: 0.45, yaw: 0 },
				done,
			}
		}
	}

	const MANEUVERS = {
		highG: () => new HighG(),
		cobra: () => new PostStall('cobra'),
		jTurn: () => new JTurn(),
		splitS: () => new SplitS(),
		immelmann: () => new Immelmann(),
		barrelRoll: () => new BarrelRoll(),
	}

	class ManeuverSystem {
		constructor() {
			this.active = null
			this.phase = 'idle'
			this.t = 0
			this.w = 0
			this.last = { done: false }
			this.cooldownUntil = new Map()
		}
		cooldownLeft(id, now) {
			return Math.max(0, (this.cooldownUntil.get(id) ?? 0) - now)
		}
		tryStart(m, x) {
			if (this.phase !== 'idle') return 'Đang thực hiện maneuver khác'
			const cd = this.cooldownLeft(m.id, x.now)
			if (cd > 0) return `Cooldown ${cd.toFixed(1)}s`
			const ok = m.canStart(x)
			if (ok !== true) return ok || 'Không đủ điều kiện'
			this.active = m
			m.begin(x)
			this.phase = 'active'
			this.t = 0
			this.w = 0
			this.last = { done: false }
			return true
		}
		abort() {
			if (this.phase === 'active') {
				this.phase = 'exit'
				this.t = 0
				this.wStart = this.w
			}
		}
		update(x, dt, baseCmd) {
			const mods = DEFAULT_MODS()
			const cmd = { ...baseCmd }
			if (!this.active) return { cmd, mods }
			this.t += dt
			const m = this.active
			if (this.phase === 'active') {
				this.last = m.update(x, dt) || { done: true }
				this.w = ease(clamp01(this.t / m.blendIn))
				if (this.last.done) {
					this.phase = 'exit'
					this.t = 0
					this.wStart = this.w
				}
			} else {
				this.w = this.wStart * (1 - ease(clamp01(this.t / m.blendOut)))
				if (this.w <= 1e-3) {
					this.cooldownUntil.set(m.id, x.now + (x.p?.cooldown ?? 3))
					this.active = null
					this.phase = 'idle'
					this.w = 0
				}
			}
			const o = this.last,
				w = this.w
			if (o.cmd) {
				for (const k of ['pitch', 'roll', 'yaw', 'throttle'])
					if (o.cmd[k] !== undefined) cmd[k] = lerp(cmd[k], o.cmd[k], w)
				if (o.cmd.afterburner !== undefined && w > 0.5) cmd.afterburner = o.cmd.afterburner
			}
			if (o.mods) {
				const om = o.mods
				mods.gScale = lerp(1, om.gScale ?? 1, w)
				mods.rateScale = lerp(1, om.rateScale ?? 1, w)
				mods.stabilityScale = lerp(1, om.stabilityScale ?? 1, w)
				mods.gripScale = lerp(1, om.gripScale ?? 1, w)
				mods.accelScale = lerp(1, om.accelScale ?? 1, w)
				mods.extraDrag = (om.extraDrag ?? 0) * w
				mods.tvc = (om.tvc ?? 0) * w
				mods.velAlign = (om.velAlign ?? 0) * w
				if (om.aoaLimit !== undefined) mods.aoaLimit = lerp(x.c.aoa.limiter, om.aoaLimit, w)
				if (om.rateOverride) {
					mods.rateOverride = om.rateOverride
					mods.overrideWeight = w
				}
			}
			return { cmd, mods }
		}
	}

	// ---------------- Pilot controller: input thô → ControlCmd + Modifiers ----------------
	const MODES = ['mouse', 'standard', 'expert']
	const MODE_NAMES = { mouse: 'MOUSE-AIM', standard: 'STANDARD', expert: 'EXPERT' }

	class PilotController {
		constructor(config) {
			this.c = config
			this.mode = 'mouse'
			this.ms = new ManeuverSystem()
			this.ap = new MouseAimAutopilot()
			this.sm = { pitch: new Smoother(), roll: new Smoother(), yaw: new Smoother() }
			this.armedUntil = -1
			this.msg = null
			this.gammaHold = null
			this.prevGamma = 0
			this.lastEvent = null
		}
		setConfig(c) {
			this.c = c
			this.ms = new ManeuverSystem()
			this.armedUntil = -1
		}
		say(text, now, kind = 'info') {
			this.msg = { text, until: now + 2.2, kind }
		}
		get aimFollowPlane() {
			return this.ms.phase !== 'idle'
		}

		start(id, x, extra = {}) {
			const p = this.c.maneuvers?.[id]
			const m = MANEUVERS[id]()
			const ctx = { ...x, p, allMan: this.c.maneuvers || {}, ...extra }
			if (!p) {
				this.say(`${m.name}: máy bay này không có`, x.now, 'warn')
				return false
			}
			const r = this.ms.tryStart(m, ctx)
			if (r === true) {
				this.say(m.name, x.now, 'ok')
				this.ap.reset()
				return true
			}
			this.say(`${m.name}: ${r}`, x.now, 'warn')
			return false
		}

		// raw: { pitch, roll, yaw, boost, brake, throttleSetting, aimDir, events[] }
		update(s, raw, dt, now, agl) {
			const c = this.c,
				ip = c.input
			const sp = this.sm.pitch.update(raw.pitch, dt, ip.smoothingTime)
			const sr = this.sm.roll.update(raw.roll, dt, ip.smoothingTime)
			const sy = this.sm.yaw.update(raw.yaw, dt, ip.smoothingTime)
			const input = { stickPitch: sp, stickRoll: sr, boost: raw.boost, brake: raw.brake }
			const x = { s, c, agl, now, input }
			const fwd = qRotate(s.rot, FWD)

			// ---- control mode → lệnh stick
			let pitch = sp,
				roll = sr,
				yaw = sy
			const bank = bankAngle(s.rot)
			if (this.mode === 'mouse' && raw.aimDir) {
				const a = this.ap.update(raw.aimDir, s, c, dt)
				pitch = Math.abs(sp) > 0.25 ? sp : a.pitch // bàn phím ghi đè autopilot
				roll = Math.abs(sr) > 0.25 ? sr : a.roll
				yaw = Math.abs(sy) > 0.25 ? sy : a.yaw
			} else if (this.mode === 'standard') {
				const nearVertical = Math.abs(fwd.y) > 0.75
				const phiT = sr * c.assist.maxBankStandard * D2R
				roll = nearVertical ? 0 : clamp((phiT - bank) * 2.0, -1, 1)
				const phiC = clamp(bank, -80 * D2R, 80 * D2R)
				const qNeed = (G * Math.sin(phiC) * Math.tan(phiC)) / Math.max(s.speed, 1)
				const pMax = evalCurve(c.rates.pitch, s.speed) * D2R
				pitch = clamp(sp + (nearVertical ? 0 : qNeed / pMax), -1, 1)
				yaw = sy + sr * 0.15
			} else {
				if (Math.abs(sr) < 0.05 && Math.abs(bank) < 60 * D2R && Math.abs(fwd.y) < 0.7)
					roll += clamp(-bank * 1.5, -1, 1) * c.assist.autoLevel
				roll = clamp(roll + sy * c.assist.autoRollFromYaw, -1, 1)
			}

			// ---- auto-trim: nhả cần pitch → giữ góc đường bay (γ)
			const gamma = Math.asin(clamp(s.vel.y / Math.max(s.speed, 1), -1, 1))
			const gdot = (gamma - this.prevGamma) / dt
			this.prevGamma = gamma
			if (this.ms.phase !== 'idle') this.gammaHold = null
			else if (
				Math.abs(sp) < 0.05 &&
				this.mode !== 'mouse' &&
				Math.abs(bank) < 70 * D2R &&
				c.assist.autoTrim > 0
			) {
				if (this.gammaHold === null) this.gammaHold = gamma
				const pMax = evalCurve(c.rates.pitch, s.speed) * D2R
				const want =
					(2.0 * (this.gammaHold - gamma) - 0.8 * gdot) * c.assist.autoTrim * Math.cos(bank)
				pitch = clamp(pitch + want / pMax, -0.6, 0.6)
			} else this.gammaHold = null

			// ---- throttle kiểu arcade: Boost / Brake / mức cruise
			let throttle = raw.throttleSetting,
				afterburner = false,
				brake = false
			if (raw.boost && !raw.brake) {
				throttle = 1
				afterburner = true
			} else if (raw.brake && !raw.boost) {
				throttle = 0.05
				brake = true
			}

			// ---- maneuver triggers
			const has = (id) => !!c.maneuvers?.[id]
			const psmArmed = now < this.armedUntil
			for (const e of raw.events) {
				if (e.type === 'chord' && e.a === 'boost+brake') {
					this.lastEvent = `Shift+Space (chord ${Math.round(e.gap * 1000)} ms)`
					if (Math.abs(sp) < 0.2 && Math.abs(sr) < 0.2) this.arm(x) // stick trung tính → PSM, ngược lại → High-G
				}
				if (e.type === 'press' && e.a === 'arm') {
					this.lastEvent = 'V (1 phím)'
					this.arm(x)
				}
				if (e.type === 'press' && e.a === 'splitS') {
					this.lastEvent = 'X (1 phím)'
					this.start('splitS', x)
				}
				if (e.type === 'press' && e.a === 'immelmann') {
					this.lastEvent = 'C (1 phím)'
					this.start('immelmann', x)
				}
				if (
					e.type === 'double' &&
					(e.a === 'rollL' || e.a === 'rollR' || e.a === 'yawL' || e.a === 'yawR')
				) {
					const dir = e.a.endsWith('R') ? 1 : -1
					this.lastEvent = `Double-tap ${e.a.startsWith('roll') ? (dir > 0 ? 'D' : 'A') : dir > 0 ? 'E' : 'Q'} (${Math.round(e.gap * 1000)} ms)`
					this.start('barrelRoll', x, { dir })
				}
			}
			if (now < this.armedUntil && this.ms.phase === 'idle') {
				if (sp > 0.45) {
					this.armedUntil = -1
					if (Math.abs(sr) > 0.45 && has('jTurn')) this.start('jTurn', x, { dir: Math.sign(sr) })
					else this.start('cobra', x)
				}
			} else if (
				raw.boost &&
				raw.brake &&
				Math.abs(sp) > 0.3 &&
				this.ms.phase === 'idle' &&
				has('highG') &&
				!psmArmed
			) {
				this.start('highG', x)
			}
			if (
				this.ms.phase === 'active' &&
				this.ms.active.id !== 'highG' &&
				sp < -0.85 &&
				this.ms.t > 0.3
			) {
				this.ms.abort()
				this.say('ABORT', now, 'warn')
			}
			if (raw.boost && raw.brake) {
				throttle = raw.throttleSetting
				afterburner = false
				brake = false
			}

			const base = { pitch, roll, yaw, throttle, brake, afterburner }
			const mx = { ...x, p: this.ms.active ? c.maneuvers?.[this.ms.active.id] : undefined }
			const out = this.ms.update(mx, dt, base)
			const curName = this.ms.active && this.ms.phase === 'active' ? this.ms.active.name : null
			if (curName && curName !== this.lastManName) this.say(curName, now, 'ok')
			this.lastManName = curName
			out.cmd.pitch = clamp(out.cmd.pitch, -1, 1)
			out.cmd.roll = clamp(out.cmd.roll, -1, 1)
			out.cmd.yaw = clamp(out.cmd.yaw, -1, 1)
			return out
		}

		arm(x) {
			if (!this.c.maneuvers?.cobra) {
				this.say('PSM: máy bay này không có', x.now, 'warn')
				return
			}
			if (this.ms.phase !== 'idle') return
			const cd = this.ms.cooldownLeft('cobra', x.now)
			if (cd > 0) {
				this.say(`PSM: cooldown ${cd.toFixed(1)}s`, x.now, 'warn')
				return
			}
			const r = new PostStall('cobra').canStart({ ...x, p: this.c.maneuvers.cobra })
			if (r !== true) {
				this.say(`PSM: ${r}`, x.now, 'warn')
				return
			}
			this.armedUntil = x.now + 0.9
			this.say('PSM READY — kéo S = Cobra · giữ S = Kulbit · S+A/D = J-turn', x.now, 'ok')
		}
	}

	// ---------------- configs ----------------
	const CONFIGS = {
		transport: {
			id: 'transport_heavy',
			name: 'Vận tải (C-130 style)',
			class: 'transport',
			massKg: 70000,
			speed: { stall: 55, min: 60, cruise: 150, max: 175 },
			cruiseThrottle: 0.75,
			thrustToWeight: 0.3,
			throttleRate: 0.25,
			rates: {
				pitch: [
					[50, 4],
					[90, 8],
					[150, 9],
					[175, 7],
				],
				roll: [
					[50, 10],
					[100, 25],
					[175, 20],
				],
				yaw: [
					[50, 3],
					[175, 5],
				],
			},
			angularAccel: { pitch: 12, roll: 25, yaw: 6 },
			gLimit: { pos: 2.5, neg: 1.0 },
			aoa: { critical: 14, limiter: 12, softZone: 3 },
			inducedDrag: 0.25,
			bodyDrag: 10,
			airbrakeDrag: 1.5,
			sideslipGrip: 2.5,
			stability: 2.0,
			thrustVectoring: false,
			assist: { autoLevel: 0.8, autoRollFromYaw: 0.3, maxBankStandard: 30, autoTrim: 1 },
			input: { deadzone: 0.15, expo: 0.5, smoothingTime: 0.2 },
			maneuvers: {},
		},
		aerobatic: {
			id: 'aerobatic_stunt',
			name: 'Biểu diễn (Extra 330 style)',
			class: 'aerobatic',
			massKg: 800,
			speed: { stall: 28, min: 30, cruise: 70, max: 110 },
			cruiseThrottle: 0.7,
			thrustToWeight: 0.9,
			throttleRate: 1.5,
			rates: {
				pitch: [
					[25, 40],
					[50, 90],
					[110, 100],
				],
				roll: [
					[25, 120],
					[50, 380],
					[110, 400],
				],
				yaw: [
					[25, 20],
					[110, 60],
				],
			},
			angularAccel: { pitch: 400, roll: 2000, yaw: 150 },
			gLimit: { pos: 10, neg: 10 },
			aoa: { critical: 18, limiter: 22, softZone: 4 },
			inducedDrag: 0.15,
			bodyDrag: 10,
			airbrakeDrag: 0.5,
			sideslipGrip: 1.2,
			stability: 1.0,
			thrustVectoring: false,
			assist: { autoLevel: 0.0, autoRollFromYaw: 0.0, maxBankStandard: 90, autoTrim: 0.6 },
			input: { deadzone: 0.1, expo: 0.35, smoothingTime: 0.05 },
			maneuvers: {
				barrelRoll: { cooldown: 1.0, duration: 2.0 },
				immelmann: { cooldown: 3.0 },
				splitS: { cooldown: 3.0, altitudeMargin: 1.3 },
			},
		},
		fighter: {
			id: 'fighter_flanker',
			name: 'Chiến đấu (Su-57 style, TVC)',
			class: 'fighter',
			massKg: 18000,
			speed: { stall: 62, min: 65, cruise: 250, max: 420 },
			cruiseThrottle: 0.6,
			thrustToWeight: 0.75,
			afterburnerTWR: 1.1,
			throttleRate: 0.8,
			rates: {
				pitch: [
					[60, 8],
					[120, 22],
					[170, 28],
					[300, 28],
					[600, 22],
				],
				roll: [
					[60, 60],
					[150, 240],
					[400, 270],
					[600, 180],
				],
				yaw: [
					[60, 5],
					[300, 12],
				],
			},
			angularAccel: { pitch: 120, roll: 720, yaw: 40 },
			gLimit: { pos: 9, neg: 3 },
			aoa: { critical: 28, limiter: 26, softZone: 4 },
			inducedDrag: 0.2,
			bodyDrag: 12,
			airbrakeDrag: 2.5,
			sideslipGrip: 3.0,
			stability: 1.5,
			thrustVectoring: true,
			assist: { autoLevel: 0.3, autoRollFromYaw: 0.4, maxBankStandard: 75, autoTrim: 1 },
			input: { deadzone: 0.12, expo: 0.45, smoothingTime: 0.05 },
			maneuvers: {
				highG: { gScale: 1.2, rateScale: 1.6, extraDrag: 2.0, aoaBonus: 6, cooldown: 0.5 },
				cobra: {
					speedMin: 70,
					speedMax: 125,
					minAGL: 300,
					peakAoA: 100,
					duration: 2.4,
					cooldown: 6,
					extraDrag: 25,
				},
				kulbit: { minAGL: 500, duration: 2.6, requiresTVC: true, extraDrag: 20 },
				jTurn: {
					speedMin: 70,
					speedMax: 140,
					minAGL: 400,
					duration: 3.2,
					cooldown: 8,
					requiresTVC: true,
				},
				splitS: { cooldown: 3, altitudeMargin: 1.3 },
				immelmann: { cooldown: 3 },
				barrelRoll: { cooldown: 2, duration: 1.6 },
			},
		},
	}

	// Thông số suy ra để designer kiểm tra config có nhất quán không
	function derived(c) {
		const out = {}
		out.cornerFromCurve = (() => {
			// V nhỏ nhất mà G-limit cắt curve
			for (let V = c.speed.min; V < c.speed.max * 1.5; V += 1)
				if ((c.gLimit.pos * G) / V <= evalCurve(c.rates.pitch, V) * D2R) return V
			return null
		})()
		out.cornerFromLift = c.speed.stall * Math.sqrt(c.gLimit.pos)
		out.vMaxAB = c.afterburnerTWR
			? c.speed.max * Math.sqrt(c.afterburnerTWR / c.thrustToWeight)
			: null
		return out
	}

	root.FC = {
		v3,
		add,
		sub,
		mul,
		dot,
		cross,
		len,
		norm,
		clamp,
		clamp01,
		lerp,
		qMul,
		qConj,
		qNorm,
		qAxisAngle,
		qRotate,
		qIdent,
		FWD,
		RIGHT,
		UP,
		G,
		D2R,
		R2D,
		evalCurve,
		stepFlight,
		createState,
		cloneState,
		bankAngle,
		DEFAULT_MODS,
		scaledRadial,
		expo,
		Smoother,
		KeyAxis,
		InputBuffer,
		PID,
		MouseAimAutopilot,
		ManeuverSystem,
		PilotController,
		MODES,
		MODE_NAMES,
		CONFIGS,
		derived,
		loopRadius,
	}
	if (typeof module !== 'undefined') module.exports = root.FC
})(typeof globalThis !== 'undefined' ? globalThis : window)
