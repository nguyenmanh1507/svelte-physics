import type { Curve, Quat, Vec3 } from './math'

/** Tham số riêng của từng maneuver; bỏ khoá trong `AircraftConfig.maneuvers` để tắt maneuver đó. */
export type ManeuverParams = {
	cooldown?: number
	duration?: number
	speedMin?: number
	speedMax?: number
	minAGL?: number
	peakAoA?: number
	extraDrag?: number
	requiresTVC?: boolean
	altitudeMargin?: number
	gScale?: number
	rateScale?: number
	aoaBonus?: number
}

export type ManeuverId =
	'highG' | 'cobra' | 'kulbit' | 'jTurn' | 'splitS' | 'immelmann' | 'barrelRoll'

/** Config data-driven: cùng một `stepFlight()` chạy mọi loại máy bay. Đơn vị m/s, deg/s, độ. */
export type AircraftConfig = {
	id: string
	name: string
	class: string
	massKg: number
	speed: { stall: number; min: number; cruise: number; max: number }
	cruiseThrottle: number
	thrustToWeight: number
	afterburnerTWR?: number
	/** tốc độ spool ga, đơn vị throttle/s */
	throttleRate: number
	/** tốc độ quay tối đa theo tốc độ bay: [[m/s, deg/s], …] */
	rates: { pitch: Curve; roll: Curve; yaw: Curve }
	/** "quán tính": gia tốc góc tối đa, deg/s² */
	angularAccel: { pitch: number; roll: number; yaw: number }
	gLimit: { pos: number; neg: number }
	aoa: { critical: number; limiter: number; softZone: number }
	inducedDrag: number
	bodyDrag: number
	airbrakeDrag: number
	sideslipGrip: number
	stability: number
	thrustVectoring: boolean
	assist: { autoLevel: number; autoRollFromYaw: number; maxBankStandard: number; autoTrim: number }
	input: { deadzone: number; expo: number; smoothingTime: number }
	maneuvers: Partial<Record<ManeuverId, ManeuverParams>>
}

export type FlightState = {
	pos: Vec3
	vel: Vec3
	rot: Quat
	/** body frame, rad/s. ω_x > 0 chúi mũi, ω_y > 0 mũi sang phải, ω_z > 0 roll trái */
	angVel: Vec3
	throttle: number
	/** mức afterburner 0..1 (đã spool) */
	ab: number
	/** góc tấn, rad */
	aoa: number
	/** góc trượt cạnh, rad */
	beta: number
	speed: number
	gLoad: number
	stalled: boolean
}

/** Lệnh điều khiển chuẩn hoá: pitch > 0 kéo mũi lên, roll > 0 nghiêng phải, yaw > 0 mũi sang phải */
export type ControlCmd = {
	pitch: number
	roll: number
	yaw: number
	throttle: number
	brake?: boolean
	afterburner?: boolean
}

/** Modifier do maneuver đè lên flight model (đã blend theo trọng số) */
export type Modifiers = {
	gScale: number
	rateScale: number
	aoaLimit: number | undefined
	stabilityScale: number
	gripScale: number
	extraDrag: number
	tvc: number
	accelScale: number
	velAlign: number
	rateOverride: Partial<Vec3> | null
	overrideWeight: number
}
