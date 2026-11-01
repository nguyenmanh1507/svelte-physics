import type { CloudParams } from '#lib/components/volumetric-cloud-2/index.js'

type NumberKey = {
	[K in keyof CloudParams]: CloudParams[K] extends number ? K : never
}[keyof CloudParams]
type BooleanKey = {
	[K in keyof CloudParams]: CloudParams[K] extends boolean ? K : never
}[keyof CloudParams]

export type RangeConfig = {
	key: NumberKey
	label: string
	min: number
	max: number
	step: number
	hint?: string
}

export type ToggleConfig = { key: BooleanKey; label: string; note?: string }

export const WEATHER_RANGES: RangeConfig[] = [
	{ key: 'coverage', label: 'Coverage', min: 0, max: 1, step: 0.01 },
	{
		key: 'cloudType',
		label: 'Cloud type',
		min: 0,
		max: 1,
		step: 0.01,
		hint: '0 = stratus · 0.5 = cumulus · 1 = cumulonimbus',
	},
	{ key: 'precipitation', label: 'Precipitation', min: 0, max: 1, step: 0.01 },
	{ key: 'windSpeed', label: 'Gió (m/s, tua nhanh)', min: 0, max: 300, step: 1 },
]

export const WEATHER_TOGGLES: ToggleConfig[] = [
	{ key: 'horizonCumulus', label: 'Chân trời luôn có cumulus', note: '(slide 47)' },
]

export const LIGHTING_RANGES: RangeConfig[] = [
	{ key: 'density', label: 'Mật độ (extinction)', min: 0.005, max: 0.1, step: 0.001 },
	{ key: 'sunElevation', label: 'Độ cao mặt trời (°)', min: -4, max: 90, step: 0.5 },
	{ key: 'sunAzimuth', label: 'Hướng mặt trời (°)', min: 0, max: 360, step: 1 },
	{ key: 'g', label: 'HG eccentricity g', min: 0, max: 0.9, step: 0.01 },
]

export const LIGHTING_TOGGLES: ToggleConfig[] = [
	{ key: 'useHG', label: 'Henyey-Greenstein' },
	{ key: 'usePowder', label: 'Powder (viền tối)' },
]

export const RENDER_SCALES = [
	{ label: '1/4', value: 0.25 },
	{ label: '1/2', value: 0.5 },
	{ label: '3/4', value: 0.75 },
	{ label: 'Full', value: 1 },
]
