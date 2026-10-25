import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BUILDING_ASSETS, BUILDING_DIR } from './building-assets'
import {
	BLOCKED_CELLS,
	BUILDING_MAP,
	buildingFootprint,
	ROAD_CELLS,
	USABLE_CELLS,
} from './building-map'
import { E, N, S, W } from './road-map'

const key = (x: number, z: number) => `${x},${z}`
const STEP: Record<number, [number, number]> = {
	[E]: [1, 0],
	[N]: [0, -1],
	[W]: [-1, 0],
	[S]: [0, 1],
}

describe('building trong thành phố', () => {
	it('mọi model building đều có file GLB trong static', () => {
		const missing = BUILDING_ASSETS.filter((a) => !existsSync(`static${BUILDING_DIR}/${a}.glb`))
		expect(missing).toEqual([])
	})

	it('có building nhưng không lấp kín mọi ô trống', () => {
		const used = BUILDING_MAP.flatMap((b) => buildingFootprint(b).cells).length
		expect(BUILDING_MAP.length).toBeGreaterThan(20)
		expect(used / USABLE_CELLS.size).toBeLessThan(0.9)
	})

	it('chỉ đặt trong khu trống đủ lớn, không đè lên đường hay đồ vật', () => {
		const bad = BUILDING_MAP.filter((b) =>
			buildingFootprint(b).cells.some(
				([x, z]) => !USABLE_CELLS.has(key(x, z)) || BLOCKED_CELLS.has(key(x, z))
			)
		)
		expect(bad).toEqual([])
		// dải hẹp 1 ô giữa hai con đường không được tính là khu đủ lớn
		expect(USABLE_CELLS.has('26,22')).toBe(false)
		expect(USABLE_CELLS.has('9,21')).toBe(false)
	})

	it('không có hai building chồng lên nhau', () => {
		const owner = new Map<string, string>()
		const overlaps: string[] = []
		for (const b of BUILDING_MAP)
			for (const [x, z] of buildingFootprint(b).cells) {
				const k = key(x, z)
				if (owner.has(k)) overlaps.push(`${b.asset} @ ${k} đè ${owner.get(k)}`)
				else owner.set(k, b.asset)
			}
		expect(overlaps).toEqual([])
	})

	it('mặt tiền của mọi building quay ra đường', () => {
		const facingAway = BUILDING_MAP.filter((b) => {
			const f = buildingFootprint(b)
			const [dx, dz] = STEP[f.front]
			// hàng ô sát mặt tiền phải đều là đường
			const front = f.cells.filter(
				([x, z]) => !f.cells.some(([ox, oz]) => ox === x + dx && oz === z + dz)
			)
			return !front.every(([x, z]) => ROAD_CELLS.has(key(x + dx, z + dz)))
		})
		expect(facingAway).toEqual([])
	})

	it('nhà chọc trời chỉ nằm ở khu trung tâm', () => {
		const far = BUILDING_MAP.filter(
			(b) => b.asset.includes('skyscraper') && Math.max(Math.abs(b.x - 15), Math.abs(b.z - 15)) > 7
		)
		expect(far).toEqual([])
	})
})
