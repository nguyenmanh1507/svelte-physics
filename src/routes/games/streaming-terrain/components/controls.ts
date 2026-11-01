import type { StreamingParams } from '#lib/components/streaming-terrain/index.js'
import type { RangeConfig } from '#lib/components/inspector/index.js'

type Range = RangeConfig<StreamingParams>

export const STREAMING_RANGES: Range[] = [
	{
		key: 'loadRadius',
		label: 'Bán kính nạp (m)',
		min: 20,
		max: 200,
		step: 5,
		hint: 'Ô có tâm trong bán kính này được nạp',
	},
	{
		key: 'unloadMargin',
		label: 'Vùng đệm huỷ (m)',
		min: 0,
		max: 50,
		step: 1,
		hint: 'Ô chỉ bị huỷ khi xa hơn bán kính nạp cộng khoảng này',
	},
	{
		key: 'maxConcurrentLoads',
		label: 'Số ô nạp song song',
		min: 1,
		max: 16,
		step: 1,
		hint: 'Ít: ô hiện dần từ gần ra xa; nhiều: nạp nhanh hơn nhưng dễ khựng',
	},
]

export const TILE_RANGES: Range[] = [
	{ key: 'tileSize', label: 'Cạnh ô (m)', min: 5, max: 60, step: 1 },
	{ key: 'tileResolution', label: 'Độ chi tiết mặt đất', min: 2, max: 64, step: 1 },
	{ key: 'objectsPerTile', label: 'Số cây mỗi ô', min: 0, max: 100, step: 1 },
	{ key: 'objectScale', label: 'Cỡ cây', min: 0.005, max: 0.04, step: 0.001 },
]

export const TERRAIN_RANGES: Range[] = [
	{ key: 'terrainFrequency', label: 'Tần số địa hình', min: 0, max: 0.2, step: 0.005 },
	{ key: 'terrainHeight', label: 'Độ cao địa hình (m)', min: 0, max: 10, step: 0.1 },
]
