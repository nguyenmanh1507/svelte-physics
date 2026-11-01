import { describe, expect, it } from 'vitest'
import { noise3, terrainHeight } from './terrain'

describe('noise địa hình', () => {
	it('bằng 0 tại các điểm lưới nguyên, kể cả toạ độ âm', () => {
		expect(noise3(0, 0, 0)).toBeCloseTo(0, 12)
		expect(noise3(3, 0, -7)).toBeCloseTo(0, 12)
		expect(noise3(-120, 5, 42)).toBeCloseTo(0, 12)
	})

	it('liên tục: hai điểm rất gần nhau cho giá trị gần nhau', () => {
		const a = noise3(1.3, 0, -2.7)
		const b = noise3(1.3001, 0, -2.7)
		expect(Math.abs(a - b)).toBeLessThan(0.001)
	})

	it('nằm trong khoảng [-1, 1] và không phẳng lì', () => {
		const values = Array.from({ length: 2000 }, (_, i) => noise3(i * 0.37, 0, i * -0.53))
		expect(Math.max(...values.map(Math.abs))).toBeLessThanOrEqual(1)
		expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.5)
	})
})

describe('độ cao mặt đất', () => {
	it('nhân theo biên độ và tần số', () => {
		expect(terrainHeight(13, -21, 0.02, 0)).toBeCloseTo(0, 12)
		expect(terrainHeight(13, -21, 0.02, 20)).toBeCloseTo(2 * terrainHeight(13, -21, 0.02, 10))
		// x · tần số nguyên -> nằm trên điểm lưới -> độ cao 0
		expect(terrainHeight(50, 100, 0.02, 10)).toBeCloseTo(0, 12)
	})
})
