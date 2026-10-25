import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { GRID, MODEL_DIR, ROAD_ASSETS } from './road-assets'
import { BARRIERS, footprint, LEVEL, openings, ROAD_MAP, TILES } from './road-map'

const roads = ROAD_MAP.filter((p) => TILES[p.asset])
const key = (...v: number[]) => v.map((n) => +n.toFixed(4)).join(',')

describe('bản đồ đường', () => {
	it('dùng đủ mọi loại asset trong City Kit - Roads', () => {
		const used = new Set(ROAD_MAP.map((p) => p.asset))
		expect(ROAD_ASSETS.filter((a) => !used.has(a))).toEqual([])
	})

	it('mọi asset đều có file GLB trong static', () => {
		const missing = ROAD_ASSETS.filter((a) => !existsSync(`static${MODEL_DIR}/${a}.glb`))
		expect(missing).toEqual([])
	})

	it('mọi tile đường nằm trọn trong lưới 30 x 30', () => {
		const outside = roads.filter((p) => {
			const f = footprint(p)
			return f.x0 < 0 || f.z0 < 0 || f.x0 + f.w > GRID || f.z0 + f.d > GRID
		})
		expect(outside).toEqual([])
	})

	it('không có hai mặt đường chồng lên nhau', () => {
		const owner = new Map<string, string>()
		const overlaps: string[] = []
		for (const p of roads) {
			const f = footprint(p)
			const base = Math.round((p.y ?? 0) / LEVEL)
			// chia footprint thành ô 0.5 để xử lý được tile nửa ô
			for (let x = f.x0; x < f.x0 + f.w; x += 0.5)
				for (let z = f.z0; z < f.z0 + f.d; z += 0.5)
					for (const level of TILES[p.asset]!.levels ?? [0]) {
						const k = key(x, z, base + level)
						if (owner.has(k)) overlaps.push(`${p.asset} @ ${k} đè ${owner.get(k)}`)
						else owner.set(k, p.asset)
					}
		}
		expect(overlaps).toEqual([])
	})

	it('mỗi cạnh mở đều nối với một cạnh mở ngược chiều cùng độ cao', () => {
		const edges = roads.flatMap((p) => openings(p).map((o) => ({ ...o, asset: p.asset })))
		const all = new Set(edges.map((o) => key(o.x, o.z, o.dir, o.level)))
		const dangling = edges
			.filter((o) => !all.has(key(o.x, o.z, (o.dir + 2) % 4, o.level)))
			.map((o) => `${o.asset} @ ${key(o.x, o.z)} hướng ${o.dir} bậc ${o.level}`)
		expect(dangling).toEqual([])
	})

	it('mỗi lớp rào đặt đúng lên tile đường tương ứng', () => {
		const barrierOf = new Map<string, string[]>()
		for (const [base, [barrier]] of Object.entries(BARRIERS))
			barrierOf.set(barrier, [...(barrierOf.get(barrier) ?? []), base])
		const at = new Set(roads.map((p) => `${p.asset}@${key(p.x, p.z)}`))
		const orphans = ROAD_MAP.filter(
			(p) =>
				barrierOf.has(p.asset) &&
				!barrierOf.get(p.asset)!.some((b) => at.has(`${b}@${key(p.x, p.z)}`))
		)
		expect(orphans).toEqual([])
	})
})
