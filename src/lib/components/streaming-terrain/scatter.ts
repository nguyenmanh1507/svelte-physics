import { createRandom, hash2 } from './noise'
import { tileCenter, type TileCoord } from './tile-grid'

export type Placement = {
	asset: number // chỉ số trong danh sách asset
	x: number // toạ độ thế giới (m)
	y: number
	z: number
	rotation: number // rad, quanh trục y
	scale: number
}

export type ScatterOptions = {
	tileSize: number
	count: number
	assetCount: number
	scale: number
	heightAt: (x: number, z: number) => number
}

// Rải vật thể đều trên một ô. PRNG seed theo toạ độ ô: cùng ô luôn ra cùng kết quả,
// nên ô bị huỷ rồi nạp lại vẫn y như cũ.
export function scatterTile(coord: TileCoord, o: ScatterOptions): Placement[] {
	if (o.assetCount <= 0) return []
	const random = createRandom(hash2(coord.x, coord.z))
	const center = tileCenter(coord, o.tileSize)
	const placements: Placement[] = []
	for (let i = 0; i < o.count; i++) {
		const x = center.x + (random() - 0.5) * o.tileSize
		const z = center.z + (random() - 0.5) * o.tileSize
		placements.push({
			asset: Math.floor(random() * o.assetCount),
			x,
			y: o.heightAt(x, z),
			z,
			rotation: random() * Math.PI * 2,
			scale: o.scale * (0.8 + random() * 0.4),
		})
	}
	return placements
}
