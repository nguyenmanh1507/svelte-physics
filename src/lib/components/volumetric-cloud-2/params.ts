import * as THREE from 'three'

export interface CloudParams {
	// modeling (weather)
	coverage: number
	cloudType: number // 0 stratus · 0.5 cumulus · 1 cumulonimbus
	precipitation: number
	windSpeed: number // m/s, tua nhanh
	horizonCumulus: boolean // chân trời luôn có cumulus [slide 47]
	// lighting
	density: number // extinction
	sunElevation: number // độ, so với mặt phẳng ngang
	sunAzimuth: number // độ, quay quanh trục Y
	g: number // HG eccentricity
	useHG: boolean
	usePowder: boolean
	sunIntensity: number
	ambient: number
	// hiệu năng
	renderScale: number // độ phân giải pass mây so với canvas
}

export const defaultCloudParams: CloudParams = {
	coverage: 0.4,
	cloudType: 0.5,
	precipitation: 0,
	windSpeed: 40,
	horizonCumulus: true,
	density: 0.045,
	sunElevation: 14,
	sunAzimuth: 200,
	g: 0.5,
	useHG: true,
	usePowder: true,
	sunIntensity: 4,
	ambient: 0.6,
	renderScale: 0.5,
}

export function sunDirection(
	elevationDeg: number,
	azimuthDeg: number,
	target = new THREE.Vector3()
) {
	const el = THREE.MathUtils.degToRad(elevationDeg)
	const az = THREE.MathUtils.degToRad(azimuthDeg)
	return target.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az))
}

// Kích thước render target của pass mây, ít nhất 1×1
export function cloudTargetSize(width: number, height: number, scale: number) {
	return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))] as const
}
