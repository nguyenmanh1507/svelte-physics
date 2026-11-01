// Logic lưới ô thuần tuý (không three.js): ô nào cần nạp, ô nào cần huỷ.

// chỉ số ô nguyên; tâm ô ở (x · tileSize, z · tileSize)
export type TileCoord = { x: number; z: number }
export type TileRef = TileCoord & { key: string; distance: number }

export const tileKey = (c: TileCoord) => `${c.x},${c.z}`

export const tileCenter = (c: TileCoord, tileSize: number) => ({
	x: c.x * tileSize,
	z: c.z * tileSize,
})

export const tileOf = (x: number, z: number, tileSize: number): TileCoord => ({
	x: Math.round(x / tileSize),
	z: Math.round(z / tileSize),
})

export function distanceToTile(x: number, z: number, c: TileCoord, tileSize: number) {
	return Math.hypot(c.x * tileSize - x, c.z * tileSize - z)
}

// Các ô có tâm cách (x, z) dưới `radius`, xếp từ gần đến xa
export function tilesInRadius(x: number, z: number, radius: number, tileSize: number): TileRef[] {
	const base = tileOf(x, z, tileSize)
	const n = Math.ceil(radius / tileSize) + 1
	const result: TileRef[] = []
	for (let dx = -n; dx <= n; dx++) {
		for (let dz = -n; dz <= n; dz++) {
			const c = { x: base.x + dx, z: base.z + dz }
			const distance = distanceToTile(x, z, c, tileSize)
			if (distance < radius) result.push({ ...c, key: tileKey(c), distance })
		}
	}
	return result.sort((a, b) => a.distance - b.distance)
}

export type StreamingPlanOptions = {
	tileSize: number
	loadRadius: number
	unloadRadius: number // >= loadRadius: vùng đệm giữa hai bán kính giữ ô đã có, không nạp ô mới
}

// So sánh tập ô đang có với vị trí hiện tại.
// `load`: ô cần có mà chưa có, gần trước; `unload`: ô đã ra khỏi unloadRadius.
export function planStreaming(
	x: number,
	z: number,
	existing: ReadonlyMap<string, TileCoord>,
	o: StreamingPlanOptions
) {
	const load = tilesInRadius(x, z, o.loadRadius, o.tileSize).filter((t) => !existing.has(t.key))
	const unload: string[] = []
	for (const [key, c] of existing) {
		if (distanceToTile(x, z, c, o.tileSize) > Math.max(o.unloadRadius, o.loadRadius)) {
			unload.push(key)
		}
	}
	return { load, unload }
}
