import { describe, expect, it } from 'vitest'
import { bottom, GROUND, pondR, randomInPond } from './terrain'

describe('terrain', () => {
	it('giữa ao sâu khoảng 0.55 m', () => {
		expect(bottom(0, 0)).toBeCloseTo(-0.55, 1)
	})

	it('ra khỏi mép ao là đất khô', () => {
		for (let i = 0; i < 16; i++) {
			const th = (i / 16) * Math.PI * 2
			const r = pondR(th) * 1.25
			expect(bottom(Math.cos(th) * r, Math.sin(th) * r)).toBeGreaterThan(0)
		}
		expect(GROUND).toBeGreaterThan(0)
	})

	it('randomInPond chỉ trả về chỗ đủ sâu', () => {
		let seed = 3
		const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
		for (let i = 0; i < 50; i++) {
			const p = randomInPond(0.3, rand)
			expect(-bottom(p.x, p.z)).toBeGreaterThan(0.3)
		}
	})
})
