import type { AircraftConfig } from './types'

export type AircraftKey = 'fighter' | 'aerobatic' | 'transport'

/** 3 config mẫu; cùng một flight model, chỉ khác số liệu */
export const CONFIGS: Record<AircraftKey, AircraftConfig> = {
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

/** Bản sao sâu để chỉnh sửa mà không đụng tới CONFIGS gốc */
export const cloneConfig = (c: AircraftConfig): AircraftConfig => structuredClone(c)

const REQUIRED_OBJECTS = [
	'speed',
	'rates',
	'angularAccel',
	'gLimit',
	'aoa',
	'assist',
	'input',
] as const
const CURVES = ['pitch', 'roll', 'yaw'] as const

/**
 * Kiểm tra sơ bộ JSON người dùng dán vào trước khi đưa cho flight model.
 * Trả về config hoặc ném Error với thông báo tiếng Việt.
 */
export function parseConfig(json: string): AircraftConfig {
	const c = JSON.parse(json) as AircraftConfig
	if (!c || typeof c !== 'object') throw new Error('config phải là object')
	for (const k of REQUIRED_OBJECTS)
		if (!c[k] || typeof c[k] !== 'object') throw new Error(`thiếu khoá "${k}"`)
	for (const k of CURVES) {
		const curve = c.rates[k]
		if (!Array.isArray(curve) || curve.length === 0 || curve.some((p) => p.length !== 2))
			throw new Error(`rates.${k} phải là [[tốc độ, deg/s], …]`)
	}
	if (!(c.speed.stall > 0) || !(c.speed.max > c.speed.stall))
		throw new Error('cần 0 < speed.stall < speed.max')
	c.maneuvers ??= {}
	return c
}
