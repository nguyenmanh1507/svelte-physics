import { defaultNubisParams, type NubisParams } from '#lib/components/nubis-cloud/index.js'

// Nubis tính bằng mét; thành phố 300 unit nên thu nhỏ cả bầu trời: tầng mây ≈ 60 – 130 unit,
// camera (cao 170 – 500) nhìn xuyên qua các khoảng trống giữa mây xuống thành phố.
// Mây tích (cumulus) thời tiết đẹp: từng đám rời 1 – 3 km, đỉnh tròn, mép xốp.
export const CITY_SKY: Partial<NubisParams> = {
	scale: 0.04,
	sunAzimuth: 56, // cùng hướng đèn cũ (120, 200, 80)
	sunElevation: 40, // nắng xiên hơn -> mây có khối, có bóng đổ trên thân mây
	// tầng 2.5 km; đỉnh mỗi cột chỉ dùng 55 – 100 % của tầng (topVariation) nên có chỗ cao thấp
	layerBottom: 1500,
	layerTop: 4000,
	// cloud map nhỏ hơn -> nhiều đám nhỏ thay vì vài vùng phủ kín cả thành phố
	weatherScale: 30_000,
	coverageBias: 0.35,
	coverageMul: 0.85, // giữa đám mây không phủ 100%, noise còn chỗ tạo hình
	typeBias: 0.7,
	precipBias: 0,
	// noise tạo hình nhỏ hơn, ăn mòn mạnh hơn -> mép tròn, xốp, bớt vách đứng
	shapeScale: 5_000,
	detailScale: 600,
	erosion: 0.5,
	// mỏng hơn, mềm hơn
	extinction: 0.03,
	densityScale: 1.3,
	windDirection: 115, // gió Tây Bắc -> Đông Nam
	windSpeed: 12,
	fogDensity: 0.000008,
}

// bộ thông số đầy đủ để slider luôn có giá trị
export const citySky = (): NubisParams => ({ ...defaultNubisParams, ...CITY_SKY })

type NumericKey = {
	[K in keyof NubisParams]: NubisParams[K] extends number ? K : never
}[keyof NubisParams]

export type CloudControl = {
	key: NumericKey
	label: string
	min: number
	max: number
	step: number
}

// Khoảng giá trị lấy theo GUI của bản gốc (docs/nubis-webgpu/src/main.js), độ dài tính bằng mét.
export const CLOUD_CONTROLS: { group: string; controls: CloudControl[] }[] = [
	{
		group: 'Mặt trời',
		controls: [
			{ key: 'sunAzimuth', label: 'Góc quay (°)', min: 0, max: 360, step: 1 },
			{ key: 'sunElevation', label: 'Góc cao (°)', min: -5, max: 90, step: 0.5 },
			{ key: 'sunIntensity', label: 'Cường độ', min: 0, max: 60, step: 0.5 },
			{ key: 'exposure', label: 'Phơi sáng', min: 0.1, max: 3, step: 0.05 },
		],
	},
	{
		group: 'Bản đồ mây',
		controls: [
			{ key: 'coverageBias', label: 'Độ phủ', min: 0, max: 1, step: 0.01 },
			{ key: 'coverageMul', label: 'Hệ số độ phủ', min: 0, max: 1.5, step: 0.01 },
			{ key: 'typeBias', label: 'Kiểu (stratus → cumulus)', min: 0, max: 1, step: 0.01 },
			{ key: 'precipBias', label: 'Mưa', min: 0, max: 1, step: 0.01 },
			{ key: 'weatherSeed', label: 'Seed', min: 0, max: 100, step: 1 },
			{ key: 'weatherScale', label: 'Kích thước map (m)', min: 10_000, max: 100_000, step: 1000 },
		],
	},
	{
		group: 'Hình dạng',
		controls: [
			{ key: 'layerBottom', label: 'Chân mây (m)', min: 500, max: 5000, step: 50 },
			{ key: 'layerTop', label: 'Đỉnh mây (m)', min: 2000, max: 12_000, step: 50 },
			{ key: 'shapeScale', label: 'Noise hình khối (m)', min: 2000, max: 30_000, step: 100 },
			{ key: 'detailScale', label: 'Noise chi tiết (m)', min: 100, max: 4000, step: 10 },
			{ key: 'erosion', label: 'Ăn mòn mép', min: 0, max: 1, step: 0.01 },
			{ key: 'curlStrength', label: 'Xoáy (curl)', min: 0, max: 800, step: 1 },
			{ key: 'cloudTopOffset', label: 'Gió cắt đỉnh (m)', min: 0, max: 3000, step: 10 },
			{ key: 'anvilBias', label: 'Đỉnh đe (anvil)', min: 0, max: 1, step: 0.01 },
			{ key: 'topVariation', label: 'Chênh lệch đỉnh', min: 0, max: 1, step: 0.01 },
			{ key: 'baseVariation', label: 'Chênh lệch chân', min: 0, max: 0.15, step: 0.005 },
			{ key: 'topErosion', label: 'Bo tròn đỉnh', min: 0, max: 1, step: 0.01 },
			{ key: 'windDirection', label: 'Hướng gió (°)', min: 0, max: 360, step: 1 },
			{ key: 'windSpeed', label: 'Tốc độ gió (m/s)', min: 0, max: 200, step: 1 },
		],
	},
	{
		group: 'Ánh sáng',
		controls: [
			{ key: 'extinction', label: 'Tắt dần σ (1/m)', min: 0.001, max: 0.1, step: 0.001 },
			{ key: 'densityScale', label: 'Mật độ', min: 0.5, max: 6, step: 0.1 },
			{ key: 'ambientStrength', label: 'Ánh sáng môi trường', min: 0, max: 3, step: 0.01 },
			{ key: 'eccentricity', label: 'HG eccentricity', min: -0.9, max: 0.95, step: 0.01 },
			{ key: 'silverIntensity', label: 'Viền bạc', min: 0, max: 3, step: 0.01 },
			{ key: 'silverSpread', label: 'Độ loang viền bạc', min: 0.01, max: 0.9, step: 0.01 },
			{ key: 'inScatterStrength', label: 'In-scatter', min: 0, max: 1, step: 0.01 },
			{ key: 'lightStepLen', label: 'Bước tia sáng (m)', min: 20, max: 600, step: 5 },
			{ key: 'msOctaves', label: 'Octave tán xạ bội', min: 1, max: 4, step: 1 },
			{ key: 'cloudShadow', label: 'Bóng mây', min: 0, max: 1, step: 0.01 },
		],
	},
	{
		group: 'Hiển thị',
		controls: [
			{ key: 'scale', label: 'Tỉ lệ (unit / m)', min: 0.01, max: 0.1, step: 0.005 },
			{ key: 'maxSteps', label: 'Số bước ray march', min: 32, max: 256, step: 1 },
			{ key: 'jitter', label: 'Jitter', min: 0, max: 1, step: 0.01 },
			{ key: 'maxDistance', label: 'Tầm xa (m)', min: 10_000, max: 150_000, step: 1000 },
			{ key: 'fogDensity', label: 'Sương (1/m)', min: 0, max: 0.00005, step: 0.000001 },
		],
	},
	{
		group: 'Hậu kỳ',
		controls: [
			{ key: 'outline', label: 'Viền mực', min: 0, max: 1, step: 0.01 },
			{ key: 'bloomStrength', label: 'Bloom', min: 0, max: 1.5, step: 0.01 },
			{ key: 'bloomThreshold', label: 'Ngưỡng bloom', min: 0, max: 3, step: 0.05 },
			{ key: 'saturation', label: 'Độ bão hoà', min: 0, max: 2, step: 0.01 },
			{ key: 'contrast', label: 'Tương phản', min: 0.7, max: 1.5, step: 0.01 },
			{ key: 'warmth', label: 'Ấm sáng / lạnh tối', min: 0, max: 1, step: 0.01 },
			{ key: 'vignette', label: 'Vignette', min: 0, max: 1, step: 0.01 },
		],
	},
]

export const RENDER_SCALES = [0.25, 0.5, 0.75, 1]

export const DEBUG_VIEWS: { value: number; label: string }[] = [
	{ value: 0, label: 'Tắt' },
	{ value: 1, label: 'Weather map' },
	{ value: 2, label: 'Heat map số bước' },
	{ value: 3, label: 'Noise hình khối' },
	{ value: 4, label: 'Noise chi tiết' },
	{ value: 5, label: 'Curl noise' },
	{ value: 6, label: 'Depth scene' },
	{ value: 7, label: 'Mật độ (cheap / full / alpha)' },
]
