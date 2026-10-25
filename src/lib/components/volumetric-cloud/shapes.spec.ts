import { describe, expect, it } from 'vitest'
import { CLOUD_KINDS, MAX_BLOBS, createCloudShape, createRandom, scatter } from './shapes'

describe('hình dáng mây', () => {
	it('cùng seed luôn cho cùng hình dáng', () => {
		for (const kind of CLOUD_KINDS) {
			expect(createCloudShape(kind, createRandom(42))).toEqual(
				createCloudShape(kind, createRandom(42))
			)
		}
		expect(createCloudShape('cumulus', createRandom(1))).not.toEqual(
			createCloudShape('cumulus', createRandom(2))
		)
	})

	it('mỗi kiểu có số blob vừa với shader và blob nằm trong hộp theo chiều ngang', () => {
		const rng = createRandom(3)
		for (let i = 0; i < 50; i++) {
			for (const kind of CLOUD_KINDS) {
				const shape = createCloudShape(kind, rng)
				expect(shape.blobs.length).toBeGreaterThan(0)
				expect(shape.blobs.length).toBeLessThanOrEqual(MAX_BLOBS)
				for (const { center, radius } of shape.blobs) {
					expect(radius).toBeGreaterThan(0)
					for (const axis of [0, 2]) {
						const half = shape.size[axis] / 2
						// mép blob không vượt quá thành hộp
						expect(Math.abs(center[axis]) * half + radius).toBeLessThanOrEqual(half + 1e-9)
					}
				}
			}
		}
	})

	it('các kiểu mây có tỉ lệ khác nhau, không chỉ là khối tròn', () => {
		const rng = createRandom(9)
		const ratio = (kind: (typeof CLOUD_KINDS)[number]) => {
			const { size } = createCloudShape(kind, rng)
			return size[1] / Math.max(size[0], size[2]) // cao / rộng
		}
		expect(ratio('towering')).toBeGreaterThan(1) // mây tháp cao hơn rộng
		expect(ratio('stratus')).toBeLessThan(0.15) // mây tầng mỏng dẹt
		expect(ratio('cumulus')).toBeGreaterThan(0.35)
		expect(ratio('cumulus')).toBeLessThan(0.7)
	})

	it('rải mây đều trong vùng, không có hai đám chung một ô lưới', () => {
		const spots = scatter(10, 266, createRandom(5))
		expect(spots).toHaveLength(10)
		const cell = (2 * 266) / 4
		const cells = new Set(
			spots.map(([x, z]) => `${Math.floor((x + 266) / cell)},${Math.floor((z + 266) / cell)}`)
		)
		expect(cells.size).toBe(10)
		for (const [x, z] of spots) {
			expect(Math.abs(x)).toBeLessThan(266)
			expect(Math.abs(z)).toBeLessThan(266)
		}
	})
})
