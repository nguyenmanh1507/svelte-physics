import { describe, expect, it } from 'vitest'

import { CONFIGS, cloneConfig } from './configs'
import { createState, stepFlight } from './flight-model'
import { InputBuffer, type InputEvent } from './input'
import { v3 } from './math'
import { BOOST_BRAKE_CHORD, PilotController, type RawInput } from './pilot'
import type { AircraftConfig, FlightState } from './types'

const DT = 1 / 120

describe('InputBuffer', () => {
	it('detects a double tap inside the window', () => {
		const b = new InputBuffer({ doubleWindow: 0.26 })
		b.press('rollR', 1.0)
		b.release('rollR', 1.05)
		b.press('rollR', 1.2)
		const dbl = b.drain().filter((e) => e.type === 'double')
		expect(dbl).toHaveLength(1)
		expect(dbl[0]).toMatchObject({ a: 'rollR' })
	})

	it('ignores taps further apart than the window', () => {
		const b = new InputBuffer({ doubleWindow: 0.26 })
		b.press('rollR', 1.0)
		b.release('rollR', 1.05)
		b.press('rollR', 1.5)
		expect(b.drain().some((e) => e.type === 'double')).toBe(false)
	})

	it('emits a chord only when both keys land within the chord window', () => {
		const chords = [{ name: BOOST_BRAKE_CHORD, keys: ['boost', 'brake'] }]
		const fast = new InputBuffer({ chords, chordWindow: 0.12 })
		fast.press('boost', 1.0)
		fast.press('brake', 1.05)
		expect(fast.drain().some((e) => e.type === 'chord')).toBe(true)

		const slow = new InputBuffer({ chords, chordWindow: 0.12 })
		slow.press('boost', 1.0)
		slow.press('brake', 1.3)
		expect(slow.drain().some((e) => e.type === 'chord')).toBe(false)
	})

	it('releaseAll lets go of every held action', () => {
		const b = new InputBuffer()
		b.press('boost', 0)
		b.press('brake', 0)
		b.releaseAll(1)
		expect(b.isDown('boost') || b.isDown('brake')).toBe(false)
	})
})

/** mô phỏng vòng lặp sim như ArcadeFlightController, với input viết sẵn theo thời gian */
function simulate(
	c: AircraftConfig,
	s: FlightState,
	pilot: PilotController,
	seconds: number,
	input: (t: number) => Partial<Omit<RawInput, 'events'>> & { events?: InputEvent[] },
	t0 = 0
) {
	let t = t0
	for (; t < t0 + seconds; t += DT) {
		const raw: RawInput = {
			pitch: 0,
			roll: 0,
			yaw: 0,
			boost: false,
			brake: false,
			throttleSetting: c.cruiseThrottle,
			aimDir: null,
			events: [],
			...input(t),
		}
		const out = pilot.update(s, raw, DT, t, s.pos.y)
		stepFlight(s, c, out.cmd, out.mods, DT)
	}
	return t
}

const press = (a: string, t: number): InputEvent[] => [{ type: 'press', a, t }]

describe('PilotController maneuvers', () => {
	it('barrel roll (double tap) rolls a full turn, then returns to idle with a cooldown', () => {
		const c = CONFIGS.fighter
		const s = createState(c, v3(0, 3000, 0), 0)
		const pilot = new PilotController(c)
		pilot.mode = 'expert'
		let fired = false
		const t = simulate(c, s, pilot, 4, (t) => {
			if (fired) return {}
			fired = true
			return { events: [{ type: 'double', a: 'rollR', t, gap: 0.1 }] }
		})
		expect(pilot.ms.phase).toBe('idle')
		expect(pilot.ms.cooldownLeft('barrelRoll', t)).toBeGreaterThan(0)
		expect(pilot.lastEvent).toMatch(/Double-tap D/)
	})

	it('PSM: arm (V) then pull → Cobra at the right speed and altitude', () => {
		const c = CONFIGS.fighter
		const s = createState(c, v3(0, 2000, 0), 0, 100)
		const pilot = new PilotController(c)
		pilot.mode = 'expert'
		simulate(c, s, pilot, 0.1, (t) => (t === 0 ? { events: press('arm', t) } : {}))
		expect(pilot.msg?.text).toMatch(/PSM READY/)
		simulate(c, s, pilot, 0.3, () => ({ pitch: 1 }), 0.1)
		expect(pilot.ms.active?.id).toBe('cobra')
		expect(pilot.ms.active?.name).toBe('COBRA')
	})

	it('PSM is refused below the minimum altitude', () => {
		const c = CONFIGS.fighter
		const s = createState(c, v3(0, 100, 0), 0, 100)
		const pilot = new PilotController(c)
		simulate(c, s, pilot, DT, (t) => ({ events: press('arm', t) }))
		expect(pilot.armedUntil).toBeLessThan(0)
		expect(pilot.msg).toMatchObject({ kind: 'warn' })
		expect(pilot.msg?.text).toMatch(/độ cao/)
	})

	it('maneuvers missing from the config are rejected with a message', () => {
		const c = CONFIGS.transport
		const s = createState(c, v3(0, 3000, 0), 0)
		const pilot = new PilotController(c)
		simulate(c, s, pilot, DT, (t) => ({ events: press('splitS', t) }))
		expect(pilot.ms.phase).toBe('idle')
		expect(pilot.msg?.text).toMatch(/không có/)
	})

	it('Split-S reverses heading and loses altitude', () => {
		const c = cloneConfig(CONFIGS.fighter)
		const s = createState(c, v3(0, 4000, 0), 0, 160)
		const pilot = new PilotController(c)
		pilot.mode = 'expert'
		simulate(c, s, pilot, 8, (t) => (t === 0 ? { events: press('splitS', t) } : {}))
		expect(s.vel.z).toBeLessThan(0)
		expect(s.pos.y).toBeLessThan(4000)
	})

	it('pushing hard on the stick aborts a running maneuver', () => {
		const c = CONFIGS.fighter
		const s = createState(c, v3(0, 4000, 0), 0, 160)
		const pilot = new PilotController(c)
		pilot.mode = 'expert'
		simulate(c, s, pilot, 0.5, (t) => (t === 0 ? { events: press('immelmann', t) } : {}))
		expect(pilot.ms.phase).toBe('active')
		simulate(c, s, pilot, 0.5, () => ({ pitch: -1 }), 0.5)
		expect(pilot.ms.phase).not.toBe('active')
		expect(pilot.msg?.text).toBe('ABORT')
	})
})
