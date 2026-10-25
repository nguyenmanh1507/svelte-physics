import { describe, expect, it } from 'vitest'
import { defaultNubisParams, packUniforms, sunDirection } from './params'

describe('hướng mặt trời', () => {
	it('góc cao 90° là đỉnh đầu, 0° nằm ngang theo góc quay', () => {
		const up = sunDirection(0, 90)
		expect(up.x).toBeCloseTo(0)
		expect(up.y).toBeCloseTo(1)
		expect(up.z).toBeCloseTo(0)

		const south = sunDirection(0, 0)
		expect(south.toArray().map((v) => +v.toFixed(6))).toEqual([0, 0, 1])
		const east = sunDirection(90, 0)
		expect(east.x).toBeCloseTo(1)
		expect(east.z).toBeCloseTo(0)
	})
})

describe('gói uniform', () => {
	it('scale = 1 giữ nguyên thứ tự gói như bản gốc', () => {
		const p = defaultNubisParams
		const u = packUniforms(p, 3)
		expect(u.uLayer.toArray()).toEqual([p.layerBottom, p.layerTop, p.planetRadius, p.maxDistance])
		expect(u.uScale.toArray()).toEqual([p.weatherScale, p.shapeScale, p.detailScale, p.curlScale])
		expect(u.uShape.toArray()).toEqual([p.curlStrength, p.erosion, p.cloudTopOffset, p.anvilBias])
		expect(u.uProfile.toArray()).toEqual([p.topVariation, p.baseVariation, p.topErosion, 0])
		expect(u.uAnim.toArray()).toEqual([p.coverageMul, p.typeOverride, p.windSpeed, 3])
		expect(u.uLight.toArray()).toEqual([
			p.extinction,
			p.ambientStrength,
			p.eccentricity,
			p.silverIntensity,
		])
		expect(u.uLight2.toArray()).toEqual([
			p.silverSpread,
			p.lightStepLen,
			p.inScatterStrength,
			p.densityScale,
		])
		expect(u.uMarch.toArray()).toEqual([p.maxSteps, p.jitter, p.debugMode, p.msOctaves])
		expect(u.fogDensity).toBe(p.fogDensity)
	})

	it('scale nhân độ dài và chia hệ số tắt dần, các hệ số không thứ nguyên giữ nguyên', () => {
		const base = packUniforms(defaultNubisParams, 0)
		const small = packUniforms({ ...defaultNubisParams, scale: 0.1 }, 0)

		expect(small.uLayer.x).toBeCloseTo(base.uLayer.x * 0.1)
		expect(small.uLayer.z).toBeCloseTo(base.uLayer.z * 0.1)
		expect(small.uScale.y).toBeCloseTo(base.uScale.y * 0.1)
		expect(small.uShape.x).toBeCloseTo(base.uShape.x * 0.1)
		expect(small.uAnim.z).toBeCloseTo(base.uAnim.z * 0.1)
		expect(small.uLight2.y).toBeCloseTo(base.uLight2.y * 0.1)

		// mật độ quang học σ·d không đổi khi thu nhỏ
		expect(small.uLight.x * small.uLight2.y).toBeCloseTo(base.uLight.x * base.uLight2.y)
		expect(small.fogDensity * small.uLayer.w).toBeCloseTo(base.fogDensity * base.uLayer.w)

		expect(small.uShape.y).toBe(base.uShape.y)
		expect(small.uLight.z).toBe(base.uLight.z)
		expect(small.uMarch).toEqual(base.uMarch)
		expect(small.uProfile).toEqual(base.uProfile)
	})

	it('ghi vào object có sẵn thay vì tạo mới', () => {
		const out = packUniforms(defaultNubisParams, 0)
		const again = packUniforms({ ...defaultNubisParams, maxSteps: 64 }, 1, out)
		expect(again).toBe(out)
		expect(out.uMarch.x).toBe(64)
		expect(out.uAnim.w).toBe(1)
	})

	it('bóng mây mặc định nằm trong 0 – 1', () => {
		expect(defaultNubisParams.cloudShadow).toBeGreaterThan(0)
		expect(defaultNubisParams.cloudShadow).toBeLessThanOrEqual(1)
	})
})
