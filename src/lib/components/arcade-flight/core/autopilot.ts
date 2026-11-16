import { bankAngle } from './flight-model'
import { D2R, clamp, clamp01, evalCurve, lerp, norm, qConj, qRotate, type Vec3 } from './math'
import type { AircraftConfig, FlightState } from './types'

export class PID {
	i = 0
	constructor(
		public kp: number,
		public ki: number,
		public kd: number,
		public iMax = 0.5
	) {}
	reset() {
		this.i = 0
	}
	update(err: number, rate: number, dt: number) {
		this.i = clamp(this.i + err * dt, -this.iMax, this.iMax)
		return this.kp * err + this.ki * this.i - this.kd * rate
	}
}

/** Mouse-aim kiểu War Thunder: người chơi chỉ hướng, PID tự lái mũi tới đó */
export class MouseAimAutopilot {
	pitchPid = new PID(3.2, 0.3, 0.55)
	yawPid = new PID(2.0, 0, 0.3)
	rollPid = new PID(2.6, 0, 0.35)
	/** lệch quá góc này thì nghiêng cánh để quay gắt, dưới thì giữ cánh bằng */
	aggressiveTurnAngle = 10 * D2R

	reset() {
		this.pitchPid.reset()
		this.yawPid.reset()
		this.rollPid.reset()
	}

	update(aimDir: Vec3, s: FlightState, c: AircraftConfig, dt: number) {
		const d = qRotate(qConj(s.rot), norm(aimDir))
		const off = Math.acos(clamp(d.z, -1, 1))
		const pitchErr = Math.atan2(d.y, Math.max(d.z, 0.05))
		const yawErr = Math.atan2(d.x, Math.max(d.z, 0.05))
		const aggressive = clamp(Math.atan2(d.x, d.y), -Math.PI / 2, Math.PI / 2)
		const level = -bankAngle(s.rot)
		const wv = clamp01(off / this.aggressiveTurnAngle)
		const rollErr = lerp(level, aggressive, wv)
		// tỉ lệ gain theo độ nhanh nhẹn của máy bay để cùng 1 bộ PID dùng cho mọi loại
		const rRate = evalCurve(c.rates.roll, s.speed) * D2R
		const pRate = evalCurve(c.rates.pitch, s.speed) * D2R
		const rs = clamp(1.5 / rRate, 0.15, 3)
		const ps = clamp(0.5 / pRate, 0.5, 4)
		return {
			pitch: d.z < 0 ? 1 : clamp(this.pitchPid.update(pitchErr * ps, -s.angVel.x * ps, dt), -1, 1),
			yaw: clamp(this.yawPid.update(yawErr, s.angVel.y, dt), -1, 1),
			roll: clamp(this.rollPid.update(rollErr * rs, -s.angVel.z * rs, dt), -1, 1),
		}
	}
}
