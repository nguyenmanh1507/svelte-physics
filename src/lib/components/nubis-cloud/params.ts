import * as THREE from 'three'

// Mọi độ dài tính bằng mét "Nubis" (tầng mây 1 500 – 4 000 m, bán kính Trái Đất 6 371 km).
// `scale` = số world unit trên một mét: scene thu nhỏ (thành phố 300 unit) vẫn có mây giống thật.
export interface NubisParams {
	// mặt trời
	sunAzimuth: number // độ, quay quanh trục Y
	sunElevation: number // độ, so với mặt phẳng ngang
	sunIntensity: number
	// tầng mây
	layerBottom: number
	layerTop: number
	planetRadius: number
	maxDistance: number
	// cloud map (weather) – đổi thì phải chạy lại compute shader
	coverageBias: number
	typeBias: number // 0 stratus → 1 cumulus
	precipBias: number
	weatherSeed: number
	coverageMul: number
	typeOverride: number // -1 = lấy theo map
	// hình dạng
	weatherScale: number
	shapeScale: number
	detailScale: number
	curlScale: number
	curlStrength: number
	erosion: number
	cloudTopOffset: number // wind shear
	anvilBias: number
	// profile theo cột (weather.a): đỉnh / chân mỗi đám cao thấp khác nhau, đỉnh bo tròn
	topVariation: number // 0–1, đỉnh nằm trong [1 - topVariation, 1] của tầng
	baseVariation: number // 0–0.15, chân nhấc lên tối đa chừng này của tầng
	topErosion: number // 0–1, 0 = gradient chỉ nhân mật độ (đỉnh phẳng), 1 = ăn mòn cả coverage
	windDirection: number // độ
	windSpeed: number // m/s
	// ánh sáng
	extinction: number // 1/m
	ambientStrength: number
	eccentricity: number
	silverIntensity: number
	silverSpread: number
	lightStepLen: number
	inScatterStrength: number
	msOctaves: number
	cloudShadow: number // 0–1, độ đậm bóng mây chiếu xuống scene
	densityScale: number
	// renderer
	maxSteps: number
	jitter: number
	renderScale: number // độ phân giải pass mây so với màn hình
	fogDensity: number // 1/m, aerial perspective
	debugMode: number
	exposure: number
	animate: boolean
	clouds: boolean // false = chỉ vẽ trời + scene
	// hậu kỳ stylized (kiểu Breath of the Wild), áp trong HDR trước tone mapping
	post: boolean
	outline: number // 0–1, độ đậm viền mực theo depth
	bloomStrength: number
	bloomThreshold: number // độ sáng HDR bắt đầu glow
	saturation: number // 1 = giữ nguyên
	contrast: number // 1 = giữ nguyên
	warmth: number // 0–1, nhuộm vùng sáng ấm / vùng tối lạnh
	vignette: number // 0–1
	scale: number // world unit / mét
}

export const defaultNubisParams: NubisParams = {
	sunAzimuth: 35,
	sunElevation: 28,
	sunIntensity: 20,
	layerBottom: 1500,
	layerTop: 4000,
	planetRadius: 6_371_000,
	maxDistance: 60_000,
	coverageBias: 0.5,
	typeBias: 0.55,
	precipBias: 0.15,
	weatherSeed: 0,
	coverageMul: 1.0,
	typeOverride: -1,
	weatherScale: 60_000,
	shapeScale: 9_000,
	detailScale: 900,
	curlScale: 8_000,
	curlStrength: 180,
	erosion: 0.35,
	cloudTopOffset: 600,
	anvilBias: 0.0,
	topVariation: 0.45,
	baseVariation: 0.04,
	topErosion: 0.75,
	windDirection: 40,
	windSpeed: 12,
	extinction: 0.05,
	ambientStrength: 0.6,
	eccentricity: 0.55,
	silverIntensity: 0.6,
	silverSpread: 0.25,
	lightStepLen: 120,
	inScatterStrength: 1.0,
	msOctaves: 4,
	cloudShadow: 0.6,
	densityScale: 2.0,
	maxSteps: 128,
	jitter: 1.0,
	renderScale: 0.5,
	fogDensity: 0.00004,
	debugMode: 0,
	exposure: 1.0,
	animate: true,
	clouds: true,
	post: true,
	outline: 0.7,
	bloomStrength: 0.3,
	bloomThreshold: 0.9,
	saturation: 1.2,
	contrast: 1.06,
	warmth: 0.5,
	vignette: 0.3,
	scale: 1,
}

// các tham số sinh ra weather texture
export const WEATHER_KEYS = ['coverageBias', 'typeBias', 'precipBias', 'weatherSeed'] as const

export const nubisPresets: Record<string, Partial<NubisParams>> = {
	'Fair weather cumulus': {
		coverageBias: 0.45,
		typeBias: 0.65,
		precipBias: 0.05,
		erosion: 0.35,
		sunElevation: 35,
	},
	'Overcast stratus': {
		coverageBias: 0.85,
		typeBias: 0.1,
		precipBias: 0.2,
		erosion: 0.25,
		sunElevation: 40,
	},
	'Storm front': {
		coverageBias: 0.7,
		typeBias: 0.9,
		precipBias: 0.8,
		anvilBias: 0.8,
		erosion: 0.3,
		sunElevation: 20,
	},
	// mây tầng tích dày, tối, có khe hở để nắng xuyên thành tia (dùng kèm NubisLightShafts)
	'Tia nắng (mây dày có khe)': {
		coverageBias: 0.68,
		coverageMul: 1.05,
		typeBias: 0.4,
		precipBias: 0.25,
		erosion: 0.4,
		sunElevation: 22,
		sunIntensity: 30,
		fogDensity: 0.000004,
	},
	Sunset: {
		coverageBias: 0.5,
		typeBias: 0.6,
		precipBias: 0.1,
		sunElevation: 3,
		sunAzimuth: 290,
		sunIntensity: 30,
	},
}

// Hướng TỚI mặt trời từ góc quay / góc cao (độ).
export function sunDirection(azimuth: number, elevation: number, target = new THREE.Vector3()) {
	const az = THREE.MathUtils.degToRad(azimuth)
	const el = THREE.MathUtils.degToRad(elevation)
	return target
		.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az))
		.normalize()
}

export type PackedUniforms = {
	uLayer: THREE.Vector4 // bottom, top, planetRadius, maxDistance
	uScale: THREE.Vector4 // weatherScale, shapeScale, detailScale, curlScale
	uShape: THREE.Vector4 // curlStrength, erosion, cloudTopOffset, anvilBias
	uProfile: THREE.Vector4 // topVariation, baseVariation, topErosion, unused
	uAnim: THREE.Vector4 // coverageMul, typeOverride, windSpeed, time
	uLight: THREE.Vector4 // extinction, ambientStrength, eccentricity, silverIntensity
	uLight2: THREE.Vector4 // silverSpread, lightStepLen, inScatterStrength, densityScale
	uMarch: THREE.Vector4 // maxSteps, jitter, debugMode, msOctaves
	fogDensity: number
}

// Gói params thành các vec4 mà shader đọc, đổi độ dài sang world unit theo `scale`.
export function packUniforms(p: NubisParams, time: number, out?: PackedUniforms): PackedUniforms {
	const u = out ?? {
		uLayer: new THREE.Vector4(),
		uScale: new THREE.Vector4(),
		uShape: new THREE.Vector4(),
		uProfile: new THREE.Vector4(),
		uAnim: new THREE.Vector4(),
		uLight: new THREE.Vector4(),
		uLight2: new THREE.Vector4(),
		uMarch: new THREE.Vector4(),
		fogDensity: 0,
	}
	const s = p.scale
	u.uLayer.set(p.layerBottom * s, p.layerTop * s, p.planetRadius * s, p.maxDistance * s)
	u.uScale.set(p.weatherScale * s, p.shapeScale * s, p.detailScale * s, p.curlScale * s)
	u.uShape.set(p.curlStrength * s, p.erosion, p.cloudTopOffset * s, p.anvilBias)
	u.uProfile.set(p.topVariation, p.baseVariation, p.topErosion, 0)
	u.uAnim.set(p.coverageMul, p.typeOverride, p.windSpeed * s, time)
	u.uLight.set(p.extinction / s, p.ambientStrength, p.eccentricity, p.silverIntensity)
	u.uLight2.set(p.silverSpread, p.lightStepLen * s, p.inScatterStrength, p.densityScale)
	u.uMarch.set(p.maxSteps, p.jitter, p.debugMode, p.msOctaves)
	u.fogDensity = p.fogDensity / s
	return u
}
