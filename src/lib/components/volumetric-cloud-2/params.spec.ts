import { describe, expect, it } from 'vitest'
import { cloudTargetSize, sunDirection } from './params'

describe('hướng mặt trời', () => {
	it('góc cao 90° là đỉnh đầu, 0° nằm ngang theo góc quay', () => {
		const up = sunDirection(90, 0)
		expect(up.y).toBeCloseTo(1)
		expect(up.x).toBeCloseTo(0)

		const east = sunDirection(0, 90)
		expect(east.x).toBeCloseTo(1)
		expect(east.y).toBeCloseTo(0)
		expect(east.z).toBeCloseTo(0)
	})

	it('luôn là vector đơn vị', () => {
		expect(sunDirection(14, 200).length()).toBeCloseTo(1)
	})
})

describe('kích thước pass mây', () => {
	it('nhân theo renderScale và làm tròn', () => {
		expect(cloudTargetSize(1280, 720, 0.5)).toEqual([640, 360])
		expect(cloudTargetSize(1001, 501, 0.25)).toEqual([250, 125])
	})

	it('không bao giờ nhỏ hơn 1×1', () => {
		expect(cloudTargetSize(0, 0, 0.5)).toEqual([1, 1])
	})
})
