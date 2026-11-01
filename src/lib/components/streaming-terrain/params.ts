export interface StreamingParams {
	// lưới ô
	tileSize: number // m, cạnh mỗi ô
	tileResolution: number // số ô lưới của mặt đất trên mỗi cạnh tile
	loadRadius: number // m, ô có tâm trong bán kính này quanh nhân vật thì được nạp
	unloadMargin: number // m, ô chỉ bị huỷ khi xa hơn loadRadius + unloadMargin (chống nạp/huỷ liên tục ở mép)
	maxConcurrentLoads: number // số ô được dựng song song, ô gần nạp trước
	// vật thể
	objectsPerTile: number // số cây / bụi rải trên mỗi ô
	objectScale: number // hệ số thu nhỏ model gốc (model xuất ra ở đơn vị cm)
	// địa hình
	terrainFrequency: number // 1/m, tần số noise độ cao
	terrainHeight: number // m, biên độ
	// debug
	tintTiles: boolean // tô mỗi ô một màu để thấy ranh giới ô
}

export const defaultStreamingParams: StreamingParams = {
	tileSize: 20,
	tileResolution: 16,
	loadRadius: 75,
	unloadMargin: 10,
	maxConcurrentLoads: 4,
	objectsPerTile: 20,
	objectScale: 0.015,
	terrainFrequency: 0.05,
	terrainHeight: 2,
	tintTiles: false,
}

// Đổi các thông số này thì phải dựng lại toàn bộ ô; các thông số khác chỉ đổi cấu hình streaming / màu
export const REBUILD_KEYS = [
	'tileSize',
	'tileResolution',
	'objectsPerTile',
	'objectScale',
	'terrainFrequency',
	'terrainHeight',
] as const satisfies readonly (keyof StreamingParams)[]

export function needsRebuild(prev: StreamingParams, next: StreamingParams) {
	return REBUILD_KEYS.some((k) => prev[k] !== next[k])
}
