import { describe, it, expect } from 'vitest'
import { terrainHeight, PLAY_HALF } from './terrain'

describe('terrainHeight', () => {
	it('stays between 1.4 m and 2.6 m deep everywhere, including outside the play area', () => {
		let sum = 0
		let n = 0
		let min = Infinity
		let max = -Infinity
		for (let x = -200; x <= 200; x += 2.5)
			for (let z = -200; z <= 200; z += 2.5) {
				const h = terrainHeight(x, z)
				min = Math.min(min, h)
				max = Math.max(max, h)
				if (Math.abs(x) <= PLAY_HALF && Math.abs(z) <= PLAY_HALF) {
					sum += h
					n++
				}
			}
		expect(min).toBeGreaterThanOrEqual(-2.6)
		expect(max).toBeLessThanOrEqual(-1.4)
		expect(sum / n).toBeGreaterThan(-2.2)
		expect(sum / n).toBeLessThan(-1.8)
	})
	it('is deterministic and not flat', () => {
		expect(terrainHeight(3.2, -7.1)).toBe(terrainHeight(3.2, -7.1))
		expect(terrainHeight(0, 0)).not.toBe(terrainHeight(12, 9))
	})
})
