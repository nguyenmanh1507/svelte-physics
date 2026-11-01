import { describe, expect, it } from 'vitest'
import { bladeIndices, bladeVertexCount, createGrassGeometry } from './grass-geometry'

describe('index của lá cỏ', () => {
	it('mỗi đoạn có 2 tam giác cho mỗi mặt', () => {
		expect(bladeIndices(1)).toHaveLength(12)
		expect(bladeIndices(6)).toHaveLength(72)
	})

	it('mặt trước dùng đỉnh [0, V), mặt sau dùng [V, 2V)', () => {
		const segments = 6
		const v = bladeVertexCount(segments)
		const indices = bladeIndices(segments)
		const front = indices.filter((_, i) => i % 12 < 6)
		const back = indices.filter((_, i) => i % 12 >= 6)
		expect(Math.min(...front)).toBe(0)
		expect(Math.max(...front)).toBe(v - 1)
		expect(Math.min(...back)).toBe(v)
		expect(Math.max(...back)).toBe(2 * v - 1)
	})

	it('mặt sau quấn ngược chiều mặt trước', () => {
		const v = bladeVertexCount(1)
		const [a, b, c, , , , d, e, f] = bladeIndices(1)
		expect([a, b, c]).toEqual([0, 1, 2])
		expect([d - v, e - v, f - v]).toEqual([2, 1, 0])
	})
})

describe('geometry cỏ', () => {
	it('đặt số instance và bounds theo vùng cỏ', () => {
		const geometry = createGrassGeometry(6, 1024, 50)
		expect(geometry.instanceCount).toBe(1024)
		expect(geometry.index?.count).toBe(72)
		expect(geometry.boundingSphere?.radius).toBe(101)
	})
})
