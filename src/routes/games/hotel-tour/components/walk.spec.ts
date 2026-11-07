import { describe, expect, it } from 'vitest'
import { moveCircle, walkDirection, type Rect } from './walk'

const wall: Rect = { minX: 1, maxX: 1.2, minZ: -5, maxZ: 5 }

describe('moveCircle', () => {
	it('đi tự do khi không có vật cản', () => {
		const p = moveCircle({ x: 0, z: 0 }, 0.5, -0.25, 0.3, [])
		expect(p.x).toBeCloseTo(0.5)
		expect(p.z).toBeCloseTo(-0.25)
	})

	it('dừng lại trước tường, cách đúng bán kính', () => {
		const p = moveCircle({ x: 0, z: 0 }, 2, 0, 0.3, [wall])
		expect(p.x).toBeLessThanOrEqual(1 - 0.3)
		expect(p.x).toBeGreaterThan(0.6)
	})

	it('trượt dọc tường khi đi chéo', () => {
		const p = moveCircle({ x: 0.6, z: 0 }, 1, 1, 0.3, [wall])
		expect(p.x).toBeLessThanOrEqual(0.7)
		expect(p.z).toBeCloseTo(1)
	})

	it('không xuyên tấm kính mỏng dù bước lớn', () => {
		const glass: Rect = { minX: -5, maxX: 5, minZ: -0.01, maxZ: 0.01 }
		const p = moveCircle({ x: 0, z: 1 }, 0, -3, 0.3, [glass])
		expect(p.z).toBeGreaterThanOrEqual(0.01 + 0.3)
	})
})

describe('walkDirection', () => {
	it('yaw 0 nhìn về -Z', () => {
		const d = walkDirection(0, 1, 0)
		expect(d.x).toBeCloseTo(0)
		expect(d.z).toBeCloseTo(-1)
	})

	it('sang phải ở yaw 0 là +X', () => {
		const d = walkDirection(0, 0, 1)
		expect(d.x).toBeCloseTo(1)
		expect(d.z).toBeCloseTo(0)
	})

	it('đi chéo vẫn có độ dài 1', () => {
		const d = walkDirection(0.7, 1, 1)
		expect(Math.hypot(d.x, d.z)).toBeCloseTo(1)
	})

	it('không bấm phím thì đứng yên', () => {
		expect(walkDirection(1, 0, 0)).toEqual({ x: 0, z: 0 })
	})
})
