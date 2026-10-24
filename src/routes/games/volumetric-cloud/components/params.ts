export interface VolumeParams {
	sigmaA: number
	sigmaS: number
	g: number
	lightIntensity: number
	lightAzimuth: number // độ, quay quanh trục Y
	lightElevation: number // độ, so với mặt phẳng ngang
	steps: number
	lightSteps: number
	noiseScale: number
}

export const defaultParams: VolumeParams = {
	sigmaA: 0.5,
	sigmaS: 2.0,
	g: 0.0,
	lightIntensity: 12,
	lightAzimuth: 60,
	lightElevation: 35,
	steps: 48,
	lightSteps: 8,
	noiseScale: 2.5,
}
