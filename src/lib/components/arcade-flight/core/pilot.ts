// =====================================================================
//  PILOT CONTROLLER — input thô → ControlCmd + Modifiers.
//  Gồm 3 chế độ điều khiển, auto-trim, throttle arcade và trigger maneuver.
// =====================================================================
import { MouseAimAutopilot } from './autopilot'
import { bankAngle } from './flight-model'
import type { InputEvent } from './input'
import { Smoother } from './input'
import {
	MANEUVERS,
	ManeuverSystem,
	PostStall,
	type ManeuverContext,
	type StartableManeuverId,
} from './maneuvers'
import { D2R, FWD, G, clamp, evalCurve, qRotate, type Vec3 } from './math'
import type { AircraftConfig, ControlCmd, FlightState, Modifiers } from './types'

export const MODES = ['mouse', 'standard', 'expert'] as const
export type PilotMode = (typeof MODES)[number]
export const MODE_NAMES: Record<PilotMode, string> = {
	mouse: 'MOUSE-AIM',
	standard: 'STANDARD',
	expert: 'EXPERT',
}

/** Tên hành động logic mà PilotController hiểu (input adapter map phím/nút → các tên này) */
export type FlightAction =
	| 'pitchUp'
	| 'pitchDown'
	| 'rollL'
	| 'rollR'
	| 'yawL'
	| 'yawR'
	| 'boost'
	| 'brake'
	| 'arm'
	| 'splitS'
	| 'immelmann'

export const BOOST_BRAKE_CHORD = 'boost+brake'

export type RawInput = {
	pitch: number
	roll: number
	yaw: number
	boost: boolean
	brake: boolean
	throttleSetting: number
	/** hướng ngắm (hệ lõi) cho chế độ mouse-aim */
	aimDir: Vec3 | null
	events: InputEvent[]
}

export type PilotMessage = { text: string; until: number; kind: 'info' | 'ok' | 'warn' }

export class PilotController {
	c: AircraftConfig
	mode: PilotMode = 'mouse'
	ms = new ManeuverSystem()
	ap = new MouseAimAutopilot()
	sm = { pitch: new Smoother(), roll: new Smoother(), yaw: new Smoother() }
	/** PSM READY tới thời điểm này (giây sim) */
	armedUntil = -1
	msg: PilotMessage | null = null
	gammaHold: number | null = null
	prevGamma = 0
	lastEvent: string | null = null
	private lastManName: string | null = null

	constructor(config: AircraftConfig) {
		this.c = config
	}

	setConfig(c: AircraftConfig) {
		this.c = c
		this.ms = new ManeuverSystem()
		this.armedUntil = -1
	}

	say(text: string, now: number, kind: PilotMessage['kind'] = 'info') {
		this.msg = { text, until: now + 2.2, kind }
	}

	/** mouse-aim đang bị bàn phím ghi đè (cập nhật mỗi bước update) */
	manualOverride = false

	/** khi đang maneuver hoặc lái tay bằng phím, vòng ngắm bám theo mũi thay vì chuột */
	get aimFollowPlane() {
		return this.ms.phase !== 'idle' || this.manualOverride
	}

	start(id: StartableManeuverId, x: ManeuverContext, extra: Partial<ManeuverContext> = {}) {
		const p = this.c.maneuvers?.[id]
		const m = MANEUVERS[id]()
		if (!p) {
			this.say(`${m.name}: máy bay này không có`, x.now, 'warn')
			return false
		}
		const r = this.ms.tryStart(m, { ...x, p, allMan: this.c.maneuvers || {}, ...extra })
		if (r === true) {
			this.say(m.name, x.now, 'ok')
			this.ap.reset()
			return true
		}
		this.say(`${m.name}: ${r}`, x.now, 'warn')
		return false
	}

	update(
		s: FlightState,
		raw: RawInput,
		dt: number,
		now: number,
		agl: number
	): { cmd: ControlCmd; mods: Modifiers } {
		const c = this.c
		const ip = c.input
		const sp = this.sm.pitch.update(raw.pitch, dt, ip.smoothingTime)
		const sr = this.sm.roll.update(raw.roll, dt, ip.smoothingTime)
		const sy = this.sm.yaw.update(raw.yaw, dt, ip.smoothingTime)
		const input = { stickPitch: sp, stickRoll: sr, boost: raw.boost, brake: raw.brake }
		const x: ManeuverContext = { s, c, agl, now, input }
		const fwd = qRotate(s.rot, FWD)

		// ---- control mode → lệnh stick
		let pitch = sp
		let roll = sr
		let yaw = sy
		const bank = bankAngle(s.rot)
		this.manualOverride = false
		if (this.mode === 'mouse' && raw.aimDir) {
			// W/S hoặc A/D ghi đè: lái tay cả pitch lẫn roll, vòng ngắm bám mũi (xem aimFollowPlane).
			// Nếu chỉ ghi đè pitch, autopilot vẫn nghiêng cánh về điểm ngắm cũ đã tụt ra sau
			// lưng → máy bay lăn liên tục khi kéo vòng.
			this.manualOverride = Math.abs(sp) > 0.25 || Math.abs(sr) > 0.25
			if (!this.manualOverride) {
				const a = this.ap.update(raw.aimDir, s, c, dt)
				pitch = a.pitch
				roll = a.roll
				yaw = Math.abs(sy) > 0.25 ? sy : a.yaw
			}
		} else if (this.mode === 'standard') {
			// A/D đặt góc nghiêng mục tiêu, pitch tự bù để giữ độ cao khi quay.
			// Tạm tắt trợ lực khi mũi gần thẳng đứng hoặc đang giữ cần mà bụng đã lên trời
			// (lộn vòng): lúc đó bank nhảy ±180° và trợ lực sẽ lật máy bay lại giữa vòng.
			const nearVertical = Math.abs(fwd.y) > 0.75
			const looping = Math.abs(sp) > 0.25 && Math.abs(bank) > 90 * D2R
			const assist = !nearVertical && !looping
			const phiT = sr * c.assist.maxBankStandard * D2R
			roll = assist ? clamp((phiT - bank) * 2.0, -1, 1) : sr
			const phiC = clamp(bank, -80 * D2R, 80 * D2R)
			const qNeed = (G * Math.sin(phiC) * Math.tan(phiC)) / Math.max(s.speed, 1)
			const pMax = evalCurve(c.rates.pitch, s.speed) * D2R
			pitch = clamp(sp + (assist ? qNeed / pMax : 0), -1, 1)
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
		let throttle = raw.throttleSetting
		let afterburner = false
		let brake = false
		if (raw.boost && !raw.brake) {
			throttle = 1
			afterburner = true
		} else if (raw.brake && !raw.boost) {
			throttle = 0.05
			brake = true
		}

		// ---- maneuver triggers
		const has = (id: StartableManeuverId) => !!c.maneuvers?.[id]
		const psmArmed = now < this.armedUntil
		for (const e of raw.events) {
			if (e.type === 'chord' && e.a === BOOST_BRAKE_CHORD) {
				this.lastEvent = `Shift+Space (chord ${Math.round(e.gap * 1000)} ms)`
				// stick trung tính → PSM, ngược lại → High-G
				if (Math.abs(sp) < 0.2 && Math.abs(sr) < 0.2) this.arm(x)
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
				const key = e.a.startsWith('roll') ? (dir > 0 ? 'D' : 'A') : dir > 0 ? 'E' : 'Q'
				this.lastEvent = `Double-tap ${key} (${Math.round(e.gap * 1000)} ms)`
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
			this.ms.active?.id !== 'highG' &&
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

		const base: ControlCmd = { pitch, roll, yaw, throttle, brake, afterburner }
		const mx: ManeuverContext = {
			...x,
			p: this.ms.active ? c.maneuvers?.[this.ms.active.id] : undefined,
		}
		const out = this.ms.update(mx, dt, base)
		const curName = this.ms.active && this.ms.phase === 'active' ? this.ms.active.name : null
		if (curName && curName !== this.lastManName) this.say(curName, now, 'ok')
		this.lastManName = curName
		out.cmd.pitch = clamp(out.cmd.pitch, -1, 1)
		out.cmd.roll = clamp(out.cmd.roll, -1, 1)
		out.cmd.yaw = clamp(out.cmd.yaw, -1, 1)
		return out
	}

	/** vào PSM READY trong 0,9 s: kéo S = Cobra, S+A/D = J-turn */
	arm(x: ManeuverContext) {
		const cobra = this.c.maneuvers?.cobra
		if (!cobra) {
			this.say('PSM: máy bay này không có', x.now, 'warn')
			return
		}
		if (this.ms.phase !== 'idle') return
		const cd = this.ms.cooldownLeft('cobra', x.now)
		if (cd > 0) {
			this.say(`PSM: cooldown ${cd.toFixed(1)}s`, x.now, 'warn')
			return
		}
		const r = new PostStall().canStart({ ...x, p: cobra })
		if (r !== true) {
			this.say(`PSM: ${r}`, x.now, 'warn')
			return
		}
		this.armedUntil = x.now + 0.9
		this.say('PSM READY — kéo S = Cobra · giữ S = Kulbit · S+A/D = J-turn', x.now, 'ok')
	}
}
