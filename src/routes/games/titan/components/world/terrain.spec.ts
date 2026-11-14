import { describe, expect, it } from 'vitest'

import {
	groundH,
	inRoamRange,
	LIQUID_HALF,
	LIQUID_LEVEL,
	ROAM_SHORE_MARGIN,
	shoreDistance,
	WORLD_HALF,
} from './terrain'

// lưới mẫu 6 m phủ cả vùng đất
const samples: Array<[x: number, z: number]> = []
for (let x = -WORLD_HALF; x <= WORLD_HALF; x += 6)
	for (let z = -WORLD_HALF; z <= WORLD_HALF; z += 6) samples.push([x, z])

describe('địa hình Titan', () => {
	it('đất liền luôn cao hơn mực chất lỏng, lòng hồ luôn thấp hơn', () => {
		for (const [x, z] of samples) {
			const shore = shoreDistance(x, z)
			const h = groundH(x, z, shore)
			if (shore > 0.5) expect(h).toBeGreaterThan(LIQUID_LEVEL)
			if (shore < -0.5) expect(h).toBeLessThan(LIQUID_LEVEL)
		}
	})

	it('có cả hồ lẫn đất liền, và lưới chất lỏng phủ hết mọi chỗ ngập', () => {
		const wet = samples.filter(([x, z]) => shoreDistance(x, z) < 0)
		expect(wet.length).toBeGreaterThan(500)
		expect(wet.length).toBeLessThan(samples.length / 4)
		for (const [x, z] of wet) expect(Math.max(Math.abs(x), Math.abs(z))).toBeLessThan(LIQUID_HALF)
	})

	it('hai hồ thông nhau qua kênh', () => {
		// đi dọc trục kênh từ hồ phụ về hồ chính, không bước nào lên cạn
		for (let t = 0; t <= 1; t += 0.02)
			expect(shoreDistance(150 - 150 * t, -110 + 110 * t)).toBeLessThan(0)
	})

	it('vùng camera được đi luôn gần hồ', () => {
		expect(inRoamRange(0, 0)).toBe(true)
		expect(inRoamRange(700, 700)).toBe(false)
		for (const [x, z] of samples)
			if (inRoamRange(x, z)) expect(shoreDistance(x, z)).toBeLessThan(ROAM_SHORE_MARGIN)
	})
})
