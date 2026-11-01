import { describe, expect, it } from 'vitest'
import { trampleDecay } from './trample-map'

describe('cỏ đứng dậy sau khi bị đè', () => {
	it('sau đúng `recovery` giây chỉ còn ~5% độ đè, không phụ thuộc fps', () => {
		const recovery = 2
		const at60fps = trampleDecay(1 / 60, recovery) ** 120
		const at30fps = trampleDecay(1 / 30, recovery) ** 60
		expect(at60fps).toBeCloseTo(Math.exp(-3))
		expect(at30fps).toBeCloseTo(at60fps)
	})

	it('recovery = 0 thì cỏ bật dậy ngay', () => {
		expect(trampleDecay(1 / 60, 0)).toBe(0)
	})
})
