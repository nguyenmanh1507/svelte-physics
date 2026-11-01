import { describe, expect, it } from 'vitest'
import { createRandom, hash2, noise2 } from './noise'
import { scatterTile } from './scatter'
import { createGroundGeometry, heightAt } from './terrain'

const P = { terrainFrequency: 0.05, terrainHeight: 2, tileSize: 20, tileResolution: 8 }

describe('noise', () => {
	it('xác định: cùng đầu vào cùng kết quả, khác seed khác kết quả', () => {
		expect(noise2(1.7, -3.2)).toBe(noise2(1.7, -3.2))
		expect(noise2(1.7, -3.2, 2)).not.toBe(noise2(1.7, -3.2, 1))
		expect(hash2(3, 4)).not.toBe(hash2(4, 3))
	})

	it('bằng 0 tại điểm lưới, nằm trong [-1, 1] và không phẳng lì', () => {
		expect(noise2(5, -8)).toBeCloseTo(0, 12)
		const values = Array.from({ length: 4000 }, (_, i) => noise2(i * 0.37, i * -0.53))
		expect(Math.max(...values.map(Math.abs))).toBeLessThanOrEqual(1)
		expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.8)
	})

	it('PRNG cho số trong [0, 1) phân bố đều', () => {
		const random = createRandom(42)
		const values = Array.from({ length: 10000 }, random)
		expect(Math.min(...values)).toBeGreaterThanOrEqual(0)
		expect(Math.max(...values)).toBeLessThan(1)
		expect(values.reduce((a, b) => a + b) / values.length).toBeCloseTo(0.5, 1)
	})
})

describe('mặt đất của ô', () => {
	it('đỉnh trên mép chung của hai ô kề nhau trùng độ cao và pháp tuyến', () => {
		const left = createGroundGeometry({ x: 0, z: 0 }, P)
		const right = createGroundGeometry({ x: 1, z: 0 }, P)
		const lp = left.attributes.position
		const rp = right.attributes.position
		const ln = left.attributes.normal
		const rn = right.attributes.normal
		let shared = 0
		for (let i = 0; i < lp.count; i++) {
			if (lp.getX(i) !== P.tileSize / 2) continue
			// cùng z, x = -tileSize/2 ở ô bên phải
			const j = [...Array(rp.count).keys()].find(
				(k) => rp.getX(k) === -P.tileSize / 2 && rp.getZ(k) === lp.getZ(i)
			)!
			expect(rp.getY(j)).toBeCloseTo(lp.getY(i), 9)
			expect(rn.getX(j)).toBeCloseTo(ln.getX(i), 9)
			expect(rn.getZ(j)).toBeCloseTo(ln.getZ(i), 9)
			shared++
		}
		expect(shared).toBe(P.tileResolution + 1)
	})
})

describe('rải vật thể', () => {
	const options = {
		tileSize: 20,
		count: 50,
		assetCount: 14,
		scale: 1,
		heightAt: (x: number, z: number) => heightAt(x, z, P),
	}

	it('cùng ô luôn ra cùng kết quả, ô khác ra kết quả khác', () => {
		expect(scatterTile({ x: 3, z: -2 }, options)).toEqual(scatterTile({ x: 3, z: -2 }, options))
		expect(scatterTile({ x: 3, z: -2 }, options)).not.toEqual(scatterTile({ x: 2, z: -2 }, options))
	})

	it('nằm trong ô, đặt trên mặt đất và dùng được mọi asset', () => {
		const placements = Array.from({ length: 20 }, (_, i) =>
			scatterTile({ x: i - 10, z: 7 }, options)
		).flat()
		for (const p of placements) {
			expect(Math.abs(p.z - 7 * 20)).toBeLessThanOrEqual(10)
			expect(p.y).toBeCloseTo(heightAt(p.x, p.z, P), 12)
		}
		// lab cũ gần như không bao giờ chọn asset cuối; ở đây asset nào cũng xuất hiện
		expect(new Set(placements.map((p) => p.asset)).size).toBe(14)
	})
})
