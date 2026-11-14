import { describe, it, expect } from 'vitest'
import { initialSub, stepSub, SUB } from './submarine'

const env = { floor: -2, surface: 0 }
const idle = { thrust: 0, turn: 0, rise: 0 }
const run = (s = initialSub(), input = idle, seconds = 10, e = env, dt = 1 / 60) => {
	for (let t = 0; t < seconds; t += dt) s = stepSub(s, input, e, dt)
	return s
}

describe('stepSub', () => {
	it('does not mutate its input', () => {
		const s = initialSub()
		stepSub(s, { thrust: 1, turn: 1, rise: 1 }, env, 1 / 60)
		expect(s).toEqual(initialSub())
	})
	it('accelerates toward max speed along +Z at yaw 0 and never exceeds it', () => {
		const s = run(initialSub(), { thrust: 1, turn: 0, rise: 0 }, 10)
		expect(s.speed).toBeGreaterThan(SUB.maxSpeed * 0.95)
		expect(s.speed).toBeLessThanOrEqual(SUB.maxSpeed)
		expect(s.z).toBeGreaterThan(5)
		expect(Math.abs(s.x)).toBeLessThan(1e-6)
	})
	it('turns left (yaw increases) with positive turn', () => {
		expect(run(initialSub(), { thrust: 0, turn: 1, rise: 0 }, 1).yaw).toBeCloseTo(SUB.turnRate, 1)
	})
	it('coasts to a stop when thrust is released', () => {
		const moving = run(initialSub(), { thrust: 1, turn: 0, rise: 0 }, 5)
		expect(Math.abs(run(moving, idle, 10).speed)).toBeLessThan(0.01)
	})
	it('stays floorGap above the seabed when diving', () => {
		expect(run(initialSub(), { thrust: 0, turn: 0, rise: -1 }, 10).y).toBeCloseTo(
			-2 + SUB.floorGap,
			5
		)
	})
	it('stops at the surface when rising, and follows a moving surface down', () => {
		const top = run(initialSub(), { thrust: 0, turn: 0, rise: 1 }, 10)
		expect(top.y).toBeCloseTo(0, 5)
		expect(stepSub(top, idle, { floor: -2, surface: -0.3 }, 1 / 60).y).toBeLessThanOrEqual(-0.3)
	})
	it('is clamped to the play area', () => {
		expect(run(initialSub(), { thrust: 1, turn: 0, rise: 0 }, 120).z).toBe(50)
	})
	it('survives a huge dt without leaving the bounds', () => {
		const input = { thrust: 1, turn: 0, rise: -1 }
		const s = stepSub(run(initialSub(), input, 3), input, env, 30)
		expect(s.z).toBeLessThanOrEqual(50)
		expect(s.y).toBeGreaterThanOrEqual(-2 + SUB.floorGap)
		expect(Number.isFinite(s.speed)).toBe(true)
	})
	it('works when the floor is above the surface limit (floor wins)', () => {
		const s = stepSub(initialSub(), idle, { floor: -0.1, surface: 0 }, 1 / 60)
		expect(s.y).toBeCloseTo(-0.1 + SUB.floorGap, 5)
	})
})
