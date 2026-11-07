import { describe, expect, it } from 'vitest'
import { createAreas } from './areas'
import { moveCircle, walkDirection } from './walk'

const RADIUS = 0.3
const areas = createAreas()

describe('createAreas', () => {
	it('có đủ ba khu với id khác nhau', () => {
		expect(areas.map((a) => a.id).sort()).toEqual(['lobby', 'rooftop', 'room'])
	})

	for (const area of areas) {
		describe(area.label, () => {
			it('điểm xuất hiện không nằm trong đồ vật', () => {
				const { x, z } = area.spawn
				const blocked = area.colliders.some(
					(r) =>
						x > r.minX - RADIUS && x < r.maxX + RADIUS && z > r.minZ - RADIUS && z < r.maxZ + RADIUS
				)
				expect(blocked).toBe(false)
			})

			it('đi mãi theo mọi hướng vẫn không ra khỏi khu', () => {
				for (let i = 0; i < 32; i++) {
					const dir = walkDirection((i / 32) * Math.PI * 2, 1, 0)
					let p = { x: area.spawn.x, z: area.spawn.z }
					// 60 m, bước 0.05 m như một frame đi bộ
					for (let s = 0; s < 1200; s++) {
						p = moveCircle(p, dir.x * 0.05, dir.z * 0.05, RADIUS, area.colliders)
					}
					expect(p.x).toBeGreaterThanOrEqual(area.bounds.minX)
					expect(p.x).toBeLessThanOrEqual(area.bounds.maxX)
					expect(p.z).toBeGreaterThanOrEqual(area.bounds.minZ)
					expect(p.z).toBeLessThanOrEqual(area.bounds.maxZ)
				}
			})

			it('mọi khối có kích thước dương', () => {
				for (const p of area.prims) {
					for (let k = 0; k < 3; k++) expect(p.max[k]).toBeGreaterThan(p.min[k])
				}
			})
		})
	}
})
