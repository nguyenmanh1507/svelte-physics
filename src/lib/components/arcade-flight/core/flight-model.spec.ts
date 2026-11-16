import { describe, expect, it } from 'vitest'

import { CONFIGS, parseConfig } from './configs'
import {
	DEFAULT_MODS,
	bankAngle,
	cloneState,
	createState,
	derived,
	stepFlight,
} from './flight-model'
import { D2R, FWD, evalCurve, qRotate, v3 } from './math'
import type { AircraftConfig, ControlCmd, FlightState } from './types'

const DT = 1 / 120

function fly(s: FlightState, c: AircraftConfig, cmd: Partial<ControlCmd>, seconds: number) {
	const full: ControlCmd = { pitch: 0, roll: 0, yaw: 0, throttle: c.cruiseThrottle, ...cmd }
	let maxG = -Infinity
	for (let t = 0; t < seconds; t += DT) {
		stepFlight(s, c, full, DEFAULT_MODS(), DT)
		maxG = Math.max(maxG, s.gLoad)
	}
	return { maxG }
}

describe('evalCurve', () => {
	const curve: [number, number][] = [
		[60, 8],
		[120, 22],
		[300, 28],
	]
	it('interpolates linearly between points', () => {
		expect(evalCurve(curve, 90)).toBeCloseTo(15)
	})
	it('clamps outside the curve', () => {
		expect(evalCurve(curve, 10)).toBe(8)
		expect(evalCurve(curve, 900)).toBe(28)
	})
})

describe('stepFlight', () => {
	for (const [key, c] of Object.entries(CONFIGS)) {
		it(`${key}: spawns trimmed — hands-off flight holds altitude for the first seconds`, () => {
			const s = createState(c, v3(0, 1500, 0), 0)
			fly(s, c, {}, 2)
			expect(Math.abs(s.pos.y - 1500)).toBeLessThan(25)
			expect(Math.abs(bankAngle(s.rot))).toBeLessThan(1 * D2R)
		})
	}

	it('flies forward along the spawn heading', () => {
		const c = CONFIGS.fighter
		const s = createState(c, v3(), 90)
		fly(s, c, {}, 1)
		expect(s.pos.x).toBeGreaterThan(200)
		expect(Math.abs(s.pos.z)).toBeLessThan(5)
	})

	it('full pull climbs while respecting the positive G limit', () => {
		const c = CONFIGS.fighter
		const s = createState(c, v3(0, 3000, 0), 0, 200)
		const { maxG } = fly(s, c, { pitch: 1 }, 1.5)
		expect(s.pos.y).toBeGreaterThan(3000)
		expect(maxG).toBeLessThan(c.gLimit.pos * 1.1)
	})

	it('roll command banks the aircraft to the right', () => {
		const c = CONFIGS.fighter
		const s = createState(c, v3(0, 3000, 0), 0)
		fly(s, c, { roll: 1 }, 0.15)
		expect(bankAngle(s.rot)).toBeGreaterThan(5 * D2R)
	})

	it('afterburner accelerates beyond military-power speed', () => {
		const c = CONFIGS.fighter
		const mil = createState(c, v3(0, 3000, 0), 0)
		const ab = cloneState(mil)
		fly(mil, c, { throttle: 1 }, 5)
		fly(ab, c, { throttle: 1, afterburner: true }, 5)
		expect(ab.ab).toBeGreaterThan(0.9)
		expect(ab.speed).toBeGreaterThan(mil.speed + 5)
	})

	it('air brake bleeds speed faster than idle throttle alone', () => {
		const c = CONFIGS.fighter
		const idle = createState(c, v3(0, 3000, 0), 0)
		const braked = cloneState(idle)
		const v0 = idle.speed
		fly(idle, c, { throttle: 0.05 }, 3)
		fly(braked, c, { throttle: 0.05, brake: true }, 3)
		expect(idle.speed).toBeLessThan(v0)
		expect(braked.speed).toBeLessThan(idle.speed - 5)
		expect(qRotate(braked.rot, FWD).z).toBeGreaterThan(0.9)
	})
})

describe('derived', () => {
	it('fighter corner speed lands in the ~650 km/h range quoted in the help', () => {
		const d = derived(CONFIGS.fighter)
		expect(d.cornerFromCurve).not.toBeNull()
		expect(d.cornerFromCurve! * 3.6).toBeGreaterThan(550)
		expect(d.cornerFromCurve! * 3.6).toBeLessThan(750)
		expect(d.vMaxAB).toBeGreaterThan(CONFIGS.fighter.speed.max)
	})
})

describe('parseConfig', () => {
	it('round-trips every bundled config', () => {
		for (const c of Object.values(CONFIGS)) expect(parseConfig(JSON.stringify(c))).toEqual(c)
	})
	it('rejects JSON missing required sections', () => {
		const broken: Partial<AircraftConfig> = { ...CONFIGS.fighter }
		delete broken.rates
		expect(() => parseConfig(JSON.stringify(broken))).toThrow(/rates/)
	})
	it('rejects malformed rate curves', () => {
		const broken = { ...CONFIGS.fighter, rates: { ...CONFIGS.fighter.rates, roll: [] } }
		expect(() => parseConfig(JSON.stringify(broken))).toThrow(/rates.roll/)
	})
	it('rejects invalid JSON', () => {
		expect(() => parseConfig('{')).toThrow()
	})
})
