import { describe, it, expect } from 'vitest'
import { chaseTarget, stepChase, CHASE } from './chaseCamera'

const sub = { x: 0, y: -1, z: 0, yaw: 0, speed: 0, vy: 0 }
const flat = () => -2

describe('chase camera', () => {
	it('sits behind and above the sub with no orbit', () => {
		const t = chaseTarget(sub, { yaw: 0, pitch: 0 })
		expect(t.x).toBeCloseTo(0, 6)
		expect(t.y).toBeCloseTo(-1 + CHASE.height, 6)
		expect(t.z).toBeCloseTo(-CHASE.distance, 6)
	})
	it('orbits around the sub at constant horizontal distance when pitch is 0', () => {
		const t = chaseTarget(sub, { yaw: Math.PI / 2, pitch: 0 })
		expect(Math.hypot(t.x, t.z)).toBeCloseTo(CHASE.distance, 6)
		expect(Math.abs(t.z)).toBeLessThan(1e-6)
	})
	it('converges on the target and never overshoots with a huge dt', () => {
		const target = { x: 4, y: -0.5, z: 3 }
		let c = { x: 0, y: 0, z: 0 }
		for (let i = 0; i < 600; i++) c = stepChase(c, target, flat, 1 / 60)
		expect(c.x).toBeCloseTo(4, 3)
		const far = stepChase({ x: 0, y: 0, z: 0 }, target, flat, 100)
		expect(far.x).toBeCloseTo(4, 6)
		expect(far.y).toBeCloseTo(-0.5, 6)
		expect(far.z).toBeCloseTo(3, 6)
	})
	it('stays floorGap above the seabed', () => {
		const c = stepChase({ x: 0, y: -1.95, z: 0 }, { x: 0, y: -3, z: 0 }, flat, 100)
		expect(c.y).toBeCloseTo(-2 + CHASE.floorGap, 6)
	})
})
