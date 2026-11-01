import type { GrassParams } from '#lib/components/infinite-grass/index.js'
import type { RangeConfig } from '#lib/components/inspector/index.js'

type Range = RangeConfig<GrassParams>

export const GRASS_RANGES: Range[] = [
	{ key: 'bladeCount', label: 'Số lá cỏ', min: 1024, max: 512 * 1024, step: 1024 },
	{
		key: 'segments',
		label: 'Số đoạn mỗi lá',
		min: 1,
		max: 12,
		step: 1,
		hint: 'Ít đoạn: lá cong gãy khúc nhưng nhẹ hơn',
	},
	{
		key: 'patchSize',
		label: 'Bán kính vùng cỏ (m)',
		min: 10,
		max: 150,
		step: 1,
		hint: 'Vùng rộng hơn với cùng số lá thì cỏ thưa hơn',
	},
	{ key: 'bladeWidth', label: 'Bề rộng lá (m)', min: 0.05, max: 1, step: 0.01 },
	{ key: 'bladeHeight', label: 'Chiều cao lá (m)', min: 0.25, max: 6, step: 0.05 },
]

export const TERRAIN_RANGES: Range[] = [
	{ key: 'terrainFrequency', label: 'Tần số địa hình', min: 0, max: 0.1, step: 0.001 },
	{ key: 'terrainHeight', label: 'Độ cao địa hình (m)', min: 0, max: 30, step: 0.5 },
]

export const WIND_RANGES: Range[] = [
	{ key: 'windStrength', label: 'Sức gió', min: 0, max: 4, step: 0.05 },
	{ key: 'windSpeed', label: 'Tốc độ gió', min: 0, max: 4, step: 0.05 },
]
