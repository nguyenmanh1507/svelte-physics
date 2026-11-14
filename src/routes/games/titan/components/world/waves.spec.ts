import { describe, expect, it } from 'vitest'

import { createWaves, phaseSpeed, TITAN_GRAVITY } from './waves'

describe('sóng trên hồ Titan', () => {
	it('trôi chậm hơn sóng cùng bước sóng trên Trái Đất theo tỉ lệ √(g_titan / g_earth)', () => {
		expect(phaseSpeed(14) / phaseSpeed(14, 9.81)).toBeCloseTo(Math.sqrt(TITAN_GRAVITY / 9.81), 10)
		// sóng 14 m: ~1.7 m/s trên Titan so với ~4.7 m/s trên Trái Đất
		expect(phaseSpeed(14)).toBeCloseTo(1.736, 2)
	})

	it('chặn trên độ cao sóng tỉ lệ thuận với gió và chỉ cỡ vài chục cm', () => {
		const waves = createWaves()
		const calm = waves.maxHeight()
		expect(calm).toBeGreaterThan(0)
		expect(calm).toBeLessThan(0.6)
		waves.state.amp = 3
		expect(waves.maxHeight()).toBeCloseTo(calm * 3, 10)
	})

	it('các hướng sóng là vector đơn vị và không có hai bước sóng trùng nhau', () => {
		const { uWaves } = createWaves()
		for (const w of uWaves) expect(Math.hypot(w.x, w.y)).toBeCloseTo(1, 10)
		expect(new Set(uWaves.map((w) => w.z)).size).toBe(uWaves.length)
	})
})
