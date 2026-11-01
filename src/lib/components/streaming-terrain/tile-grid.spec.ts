import { describe, expect, it } from 'vitest'
import { planStreaming, tileKey, tileOf, tilesInRadius, type TileCoord } from './tile-grid'

const OPTIONS = { tileSize: 20, loadRadius: 75, unloadRadius: 85 }

describe('lưới ô', () => {
	it('làm tròn vị trí về ô gần nhất, kể cả toạ độ âm', () => {
		expect(tileOf(9, -11, 20)).toEqual({ x: 0, z: -1 })
		expect(tileOf(-31, 49, 20)).toEqual({ x: -2, z: 2 })
	})

	it('chỉ lấy ô có tâm trong bán kính và xếp gần trước', () => {
		const tiles = tilesInRadius(3, -4, 75, 20)
		expect(tiles[0]).toMatchObject({ x: 0, z: 0 })
		expect(tiles.every((t) => t.distance < 75)).toBe(true)
		for (let i = 1; i < tiles.length; i++) {
			expect(tiles[i].distance).toBeGreaterThanOrEqual(tiles[i - 1].distance)
		}
		// không bỏ sót: mọi ô trong bán kính đều có mặt
		const keys = new Set(tiles.map((t) => t.key))
		for (let x = -5; x <= 5; x++) {
			for (let z = -5; z <= 5; z++) {
				const inside = Math.hypot(x * 20 - 3, z * 20 + 4) < 75
				expect(keys.has(tileKey({ x, z }))).toBe(inside)
			}
		}
	})
})

describe('kế hoạch streaming', () => {
	const toMap = (tiles: TileCoord[]) => new Map(tiles.map((c) => [tileKey(c), c]))

	it('lúc đầu nạp mọi ô trong tầm, không huỷ gì', () => {
		const plan = planStreaming(0, 0, new Map(), OPTIONS)
		expect(plan.load.length).toBe(tilesInRadius(0, 0, 75, 20).length)
		expect(plan.unload).toEqual([])
	})

	it('không nạp lại ô đã có', () => {
		const existing = toMap(tilesInRadius(0, 0, 75, 20))
		expect(planStreaming(0, 0, existing, OPTIONS).load).toEqual([])
	})

	it('vùng đệm: ô vừa ra khỏi loadRadius chưa bị huỷ, ra khỏi unloadRadius mới huỷ', () => {
		const tile = { x: 4, z: 0 } // tâm cách gốc 80 m
		const existing = toMap([tile])
		expect(planStreaming(0, 0, existing, OPTIONS).unload).toEqual([])
		expect(planStreaming(-10, 0, existing, OPTIONS).unload).toEqual(['4,0'])
	})
})
