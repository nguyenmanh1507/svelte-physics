// =====================================================================
//  MANEUVERS — state machine: idle → active (blend in) → exit (blend out) → cooldown.
//  Mỗi maneuver trả về lệnh stick và/hoặc modifier đè lên flight model.
// =====================================================================
import { DEFAULT_MODS, bankAngle, loopRadius } from './flight-model'
import {
	D2R,
	FWD,
	G,
	RIGHT,
	UP,
	attitudeError,
	clamp,
	clamp01,
	dot,
	ease,
	len,
	lerp,
	mul,
	qAxisAngle,
	qMul,
	qRotate,
	qYawFrom,
	v3,
	type Quat,
	type Vec3,
} from './math'
import type {
	AircraftConfig,
	ControlCmd,
	FlightState,
	ManeuverId,
	ManeuverParams,
	Modifiers,
} from './types'

export type ManeuverInput = {
	stickPitch: number
	stickRoll: number
	boost: boolean
	brake: boolean
}

export type ManeuverContext = {
	s: FlightState
	c: AircraftConfig
	/** độ cao so với mặt đất, m */
	agl: number
	now: number
	input: ManeuverInput
	p?: ManeuverParams
	allMan?: AircraftConfig['maneuvers']
	/** hướng (+1 phải / −1 trái) cho barrel roll, J-turn */
	dir?: number
}

export type ManeuverMods = Partial<Omit<Modifiers, 'rateOverride' | 'overrideWeight'>> & {
	rateOverride?: Vec3
}

export type ManeuverOutput = {
	cmd?: Partial<ControlCmd>
	mods?: ManeuverMods
	done: boolean
}

/** `true` = được phép; chuỗi = lý do từ chối (hiển thị cho người chơi) */
export type StartCheck = true | false | string

export interface Maneuver {
	readonly id: ManeuverId
	readonly name: string
	readonly blendIn: number
	readonly blendOut: number
	canStart(x: ManeuverContext): StartCheck
	begin(x: ManeuverContext): void
	update(x: ManeuverContext, dt: number): ManeuverOutput
}

const speedRange = (p: ManeuverParams) =>
	`Cần tốc độ ${Math.round((p.speedMin ?? 0) * 3.6)}–${Math.round((p.speedMax ?? 0) * 3.6)} km/h`

export class HighG implements Maneuver {
	readonly id = 'highG'
	readonly name = 'HIGH-G TURN'
	readonly blendIn = 0.15
	readonly blendOut = 0.3
	canStart({ s, c }: ManeuverContext) {
		return s.speed > c.speed.stall * 1.3
	}
	begin() {}
	update({ s, c, p = {}, input }: ManeuverContext): ManeuverOutput {
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

/** Cobra (curve AoA mục tiêu), tự nâng cấp lên Kulbit nếu tiếp tục giữ kéo */
export class PostStall implements Maneuver {
	readonly id = 'cobra'
	readonly blendIn = 0.08
	readonly blendOut = 0.7
	mode: 'cobra' | 'kulbit' = 'cobra'
	t = 0
	/** góc pitch đã quay tích luỹ, rad */
	theta = 0
	t0 = 0
	th0 = 0
	cobraP: ManeuverParams = {}
	kulbitP: ManeuverParams | undefined

	get name() {
		return this.mode === 'kulbit' ? 'KULBIT' : 'COBRA'
	}

	canStart({ s, agl, p }: ManeuverContext): StartCheck {
		if (!p) return 'Máy bay không hỗ trợ'
		if (s.speed < (p.speedMin ?? 0) || s.speed > (p.speedMax ?? Infinity)) return speedRange(p)
		if (agl < (p.minAGL ?? 0)) return `Cần độ cao > ${p.minAGL} m`
		if (Math.abs(bankAngle(s.rot)) > 35 * D2R) return 'Cần cánh gần cân bằng'
		return true
	}

	begin({ allMan = {} }: ManeuverContext) {
		this.t = 0
		this.theta = 0
		this.mode = 'cobra'
		this.kulbitP = allMan.kulbit
		this.cobraP = allMan.cobra ?? {}
	}

	update({ s, c, input, agl }: ManeuverContext, dt: number): ManeuverOutput {
		this.t += dt
		this.theta += -s.angVel.x * dt
		const mods: ManeuverMods = {
			aoaLimit: 180,
			stabilityScale: 0,
			gripScale: 0,
			tvc: 1,
			accelScale: 4,
		}
		if (this.mode === 'cobra') {
			const p = this.cobraP
			const duration = p.duration ?? 2.4
			const u = clamp01(this.t / duration)
			const aoaT = (p.peakAoA ?? 100) * D2R * Math.sin(Math.PI * u)
			const rate = clamp(5 * (aoaT - s.aoa), -2.6, 2.6)
			const k = this.kulbitP
			if (
				k &&
				this.t > 0.6 &&
				this.t < 1.0 &&
				input.stickPitch > 0.5 &&
				agl > (k.minAGL ?? 0) &&
				(!k.requiresTVC || c.thrustVectoring)
			) {
				this.mode = 'kulbit'
				this.t0 = this.t
				this.th0 = this.theta
			}
			mods.extraDrag = p.extraDrag ?? 20
			mods.rateOverride = v3(-rate, 0, 0)
			return { mods, done: (u >= 1 && s.aoa < 15 * D2R) || this.t > duration + 1.5 }
		}
		const p = this.kulbitP ?? {}
		const T = p.duration ?? 2.6
		const uk = (this.t - this.t0) / T
		const span = 2 * Math.PI - this.th0
		const thT = this.th0 + span * ease(uk)
		const ff = uk < 1 ? (span * 6 * clamp01(uk) * (1 - clamp01(uk))) / T : 0 // đạo hàm smoothstep
		const rate = clamp(ff + 5 * (thT - this.theta), -0.5, 4.5)
		mods.extraDrag = p.extraDrag ?? 20
		mods.rateOverride = v3(-rate, 0, 0)
		return { mods, done: (uk >= 1 && this.theta > 2 * Math.PI - 0.2) || uk > 1.7 }
	}
}

/** Herbst / J-turn: chuỗi hướng mục tiêu tương đối khung lúc vào + attitude controller */
export class JTurn implements Maneuver {
	readonly id = 'jTurn'
	readonly name = 'HERBST / J-TURN'
	readonly blendIn = 0.1
	readonly blendOut = 0.7
	t = 0
	E: Quat = { x: 0, y: 0, z: 0, w: 1 }
	dir = 1

	canStart({ s, c, agl, p }: ManeuverContext): StartCheck {
		if (!p) return 'Máy bay không hỗ trợ'
		if (p.requiresTVC && !c.thrustVectoring) return 'Cần thrust vectoring'
		if (s.speed < (p.speedMin ?? 0) || s.speed > (p.speedMax ?? Infinity)) return speedRange(p)
		if (agl < (p.minAGL ?? 0)) return `Cần độ cao > ${p.minAGL} m`
		return true
	}

	begin({ s, dir }: ManeuverContext) {
		this.t = 0
		this.E = qYawFrom(qRotate(s.rot, FWD))
		this.dir = dir || 1
	}

	update({ s, p = {} }: ManeuverContext, dt: number): ManeuverOutput {
		this.t += dt
		const u = clamp01(this.t / (p.duration ?? 3.2))
		let th: number
		let psi: number
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

/** Split-S: roll ngửa → kéo hết cỡ tới khi đảo hướng (quay 180° bổ nhào) */
export class SplitS implements Maneuver {
	readonly id = 'splitS'
	readonly name = 'SPLIT-S'
	readonly blendIn = 0.1
	readonly blendOut = 0.4
	phase = 0
	t = 0
	entryFwd: Vec3 = v3()
	dir = 1

	canStart({ s, c, agl, p }: ManeuverContext): StartCheck {
		if (!p) return 'Máy bay không hỗ trợ'
		const need = 2 * loopRadius(s, c) * (p.altitudeMargin ?? 1.3)
		return agl > need ? true : `Không đủ độ cao (cần ~${Math.round(need)} m)`
	}

	begin({ s }: ManeuverContext) {
		this.phase = 0
		this.t = 0
		this.entryFwd = qRotate(s.rot, FWD)
		this.dir = bankAngle(s.rot) >= 0 ? 1 : -1
	}

	update({ s, p = {} }: ManeuverContext, dt: number): ManeuverOutput {
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

/** Immelmann: kéo nửa vòng lên → roll 180° khi đã ngửa */
export class Immelmann implements Maneuver {
	readonly id = 'immelmann'
	readonly name = 'IMMELMANN'
	readonly blendIn = 0.1
	readonly blendOut = 0.4
	phase = 0
	t = 0
	entryFwd: Vec3 = v3()

	canStart({ s, c, p }: ManeuverContext): StartCheck {
		if (!p) return 'Máy bay không hỗ trợ'
		const R = loopRadius(s, c)
		const need = c.speed.min ** 2 + 2 * G * 2 * R * 0.6
		return s.speed ** 2 > need
			? true
			: `Không đủ năng lượng (cần ~${Math.round(Math.sqrt(need) * 3.6)} km/h)`
	}

	begin({ s }: ManeuverContext) {
		this.phase = 0
		this.t = 0
		this.entryFwd = qRotate(s.rot, FWD)
	}

	update({ s, p = {} }: ManeuverContext, dt: number): ManeuverOutput {
		this.t += dt
		const fwd = qRotate(s.rot, FWD)
		const up = qRotate(s.rot, UP)
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

export class BarrelRoll implements Maneuver {
	readonly id = 'barrelRoll'
	readonly name = 'BARREL ROLL'
	readonly blendIn = 0.08
	readonly blendOut = 0.3
	t = 0
	rolled = 0
	dir = 1

	canStart({ p }: ManeuverContext): StartCheck {
		return p ? true : 'Máy bay không hỗ trợ'
	}

	begin({ dir }: ManeuverContext) {
		this.t = 0
		this.rolled = 0
		this.dir = dir || 1
	}

	update({ s, p = {} }: ManeuverContext, dt: number): ManeuverOutput {
		this.t += dt
		this.rolled += Math.abs(s.angVel.z) * dt
		const done = this.rolled >= 2 * Math.PI - 0.1 || this.t > (p.duration ?? 1.6) * 1.6
		return {
			cmd: done ? { roll: 0, pitch: 0 } : { roll: this.dir * 0.9, pitch: 0.45, yaw: 0 },
			done,
		}
	}
}

/** Maneuver có thể khởi động trực tiếp (Kulbit chỉ là nhánh nâng cấp của Cobra) */
export type StartableManeuverId = Exclude<ManeuverId, 'kulbit'>

export const MANEUVERS: Record<StartableManeuverId, () => Maneuver> = {
	highG: () => new HighG(),
	cobra: () => new PostStall(),
	jTurn: () => new JTurn(),
	splitS: () => new SplitS(),
	immelmann: () => new Immelmann(),
	barrelRoll: () => new BarrelRoll(),
}

const CMD_AXES = ['pitch', 'roll', 'yaw', 'throttle'] as const

export class ManeuverSystem {
	active: Maneuver | null = null
	phase: 'idle' | 'active' | 'exit' = 'idle'
	/** thời gian trong pha hiện tại */
	t = 0
	/** trọng số blend hiện tại 0..1 */
	w = 0
	wStart = 0
	last: ManeuverOutput = { done: false }
	cooldownUntil = new Map<string, number>()

	cooldownLeft(id: string, now: number) {
		return Math.max(0, (this.cooldownUntil.get(id) ?? 0) - now)
	}

	/** `true` nếu đã bắt đầu, ngược lại là lý do từ chối */
	tryStart(m: Maneuver, x: ManeuverContext): true | string {
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

	update(x: ManeuverContext, dt: number, baseCmd: ControlCmd) {
		const mods = DEFAULT_MODS()
		const cmd: ControlCmd = { ...baseCmd }
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
		const o = this.last
		const w = this.w
		if (o.cmd) {
			for (const k of CMD_AXES) {
				const v = o.cmd[k]
				if (v !== undefined) cmd[k] = lerp(cmd[k], v, w)
			}
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
