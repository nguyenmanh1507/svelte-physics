import { describe, expect, it } from 'vitest'

import {
	GROUND_CLEARANCE,
	RING_COUNT,
	RING_HIT_RADIUS,
	RING_RADIUS,
	collidesWithTerrain,
	createCourse,
	groundHeightAt,
	passRings,
} from './course'

describe('createCourse', () => {
	it('is deterministic for a given seed', () => {
		expect(createCourse(7)).toEqual(createCourse(7))
		expect(createCourse(8).hills).not.toEqual(createCourse(7).hills)
	})

	it('places 12 rings on the course circle with tangents perpendicular to the radius', () => {
		const { rings } = createCourse()
		expect(rings).toHaveLength(RING_COUNT)
		for (const r of rings) {
			expect(Math.hypot(r.position.x, r.position.z)).toBeCloseTo(RING_RADIUS)
			expect(r.position.x * r.tangent.x + r.position.z * r.tangent.z).toBeCloseTo(0)
		}
	})

	it('keeps hills clear of the ring course', () => {
		const { hills } = createCourse()
		expect(hills).toHaveLength(70)
		for (const h of hills)
			expect(Math.abs(Math.hypot(h.x, h.z) - RING_RADIUS)).toBeGreaterThanOrEqual(h.r + 700)
	})

	it('spawns over open ground, above the rings', () => {
		const { spawn, hills } = createCourse()
		expect(groundHeightAt(hills, spawn.position.x, spawn.position.z)).toBe(0)
		expect(spawn.position.y).toBeGreaterThan(1000)
	})
})

describe('terrain', () => {
	const hills = [{ x: 0, z: 0, r: 100, h: 50, rot: 0 }]

	it('is a cone: peak at the centre, zero at the rim', () => {
		expect(groundHeightAt(hills, 0, 0)).toBe(50)
		expect(groundHeightAt(hills, 50, 0)).toBeCloseTo(25)
		expect(groundHeightAt(hills, 200, 0)).toBe(0)
	})

	it('collides with flat ground and hill slopes', () => {
		expect(collidesWithTerrain(hills, { x: 500, y: GROUND_CLEARANCE - 0.1, z: 0 })).toBe(true)
		expect(collidesWithTerrain(hills, { x: 500, y: 10, z: 0 })).toBe(false)
		expect(collidesWithTerrain(hills, { x: 0, y: 40, z: 0 })).toBe(true)
		expect(collidesWithTerrain(hills, { x: 0, y: 60, z: 0 })).toBe(false)
	})
})

describe('passRings', () => {
	it('marks only rings within the hit radius, once', () => {
		const { rings } = createCourse()
		const passed = rings.map(() => false)
		const p = { ...rings[3].position, x: rings[3].position.x + RING_HIT_RADIUS * 0.5 }
		expect(passRings(rings, passed, p)).toEqual([3])
		expect(passRings(rings, passed, p)).toEqual([])
		expect(passed.filter(Boolean)).toHaveLength(1)
	})
})
