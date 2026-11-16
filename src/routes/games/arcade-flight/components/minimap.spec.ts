import { describe, expect, it } from 'vitest'

import { FlightTrail, easeView, fitView, niceLength, projector } from './minimap'

describe('FlightTrail', () => {
	it('records a point only after moving at least minStep', () => {
		const t = new FlightTrail(25, 100)
		expect(t.push({ x: 0, y: 1000, z: 0 })).toBe(true)
		expect(t.push({ x: 10, y: 1000, z: 0 })).toBe(false)
		expect(t.push({ x: 30, y: 1000, z: 0 })).toBe(true)
		expect(t.points).toHaveLength(2)
	})

	it('drops the oldest points beyond maxPoints and copies inputs', () => {
		const t = new FlightTrail(1, 3)
		const p = { x: 0, y: 0, z: 0 }
		for (let i = 0; i < 5; i++) {
			p.x = i * 10
			t.push(p)
		}
		expect(t.points.map((q) => q.x)).toEqual([20, 30, 40])
		t.clear()
		expect(t.points).toHaveLength(0)
	})
})

describe('fitView', () => {
	it('falls back to the minimum square around the origin with no points', () => {
		expect(fitView([[]], 500)).toEqual({ cx: 0, cz: 0, half: 500 })
	})

	it('centres on all groups and keeps the view square with a margin', () => {
		const v = fitView(
			[
				[
					{ x: -1000, z: 0 },
					{ x: 3000, z: 0 },
				],
				[{ x: 0, z: 1000 }],
			],
			100,
			1
		)
		expect(v).toEqual({ cx: 1000, cz: 500, half: 2000 })
	})

	it('eases part of the way towards the target', () => {
		const v = easeView({ cx: 0, cz: 0, half: 100 }, { cx: 100, cz: -100, half: 300 }, 0.5)
		expect(v).toEqual({ cx: 50, cz: -50, half: 200 })
	})
})

describe('projector', () => {
	it('maps the view square onto the canvas with −Z at the top', () => {
		const map = projector({ cx: 100, cz: 0, half: 500 }, 200)
		expect(map(100, 0)).toEqual([100, 100])
		expect(map(600, 0)).toEqual([200, 100])
		expect(map(100, -500)).toEqual([100, 0])
	})
})

describe('niceLength', () => {
	it('picks the largest 1/2/5 × 10^n not above the limit', () => {
		expect(niceLength(2700)).toBe(2000)
		expect(niceLength(999)).toBe(500)
		expect(niceLength(130)).toBe(100)
		expect(niceLength(5000)).toBe(5000)
	})
})
