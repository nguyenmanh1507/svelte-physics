import { describe, expect, it } from 'vitest'
import { defaultLightShaftParams, shadowMapOrigin } from './light-shafts'

describe('tia nắng xuyên mây', () => {
	it('shadow map bám lưới texel và luôn chứa camera ở giữa', () => {
		const extent = 1024
		const texel = extent / 256
		for (const [x, z] of [
			[0, 0],
			[13.7, -250.2],
			[-999.9, 4096.5],
		]) {
			const [ox, oz] = shadowMapOrigin(x, z, extent, 256)
			expect(Math.abs(ox / texel - Math.round(ox / texel))).toBeLessThan(1e-9)
			expect(Math.abs(oz / texel - Math.round(oz / texel))).toBeLessThan(1e-9)
			// camera nằm trong map, lệch tâm tối đa một texel
			expect(x - ox).toBeGreaterThanOrEqual(extent / 2)
			expect(x - ox).toBeLessThan(extent / 2 + texel)
			expect(z - oz).toBeGreaterThanOrEqual(extent / 2)
			expect(z - oz).toBeLessThan(extent / 2 + texel)
		}
	})

	it('di chuyển camera dưới một texel thì shadow map không xê dịch', () => {
		const a = shadowMapOrigin(100, 100, 1024, 256)
		const b = shadowMapOrigin(100.5, 101, 1024, 256)
		expect(b).toEqual(a)
	})

	it('tham số mặc định hợp lệ cho shader (số bước trong giới hạn vòng lặp 64)', () => {
		expect(defaultLightShaftParams.steps).toBeGreaterThan(0)
		expect(defaultLightShaftParams.steps).toBeLessThanOrEqual(64)
		expect(defaultLightShaftParams.resolution).toBeGreaterThan(0)
		expect(defaultLightShaftParams.resolution).toBeLessThanOrEqual(1)
		expect(defaultLightShaftParams.sharpness).toBeGreaterThanOrEqual(0)
		expect(defaultLightShaftParams.sharpness).toBeLessThanOrEqual(1)
		expect(defaultLightShaftParams.blurLength).toBeGreaterThan(0)
	})
})
