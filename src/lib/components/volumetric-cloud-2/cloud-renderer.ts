import * as THREE from 'three'
import { FullscreenPass } from './fullscreen-pass'
import type { NoiseTextures } from './noise-textures'
import { cloudTargetSize, defaultCloudParams, sunDirection, type CloudParams } from './params'
import common from './shaders/common.glsl?raw'
import sky from './shaders/sky.glsl?raw'
import cloudsFrag from './shaders/clouds.frag?raw'
import compositeFrag from './shaders/composite.frag?raw'

const WIND_DIR = new THREE.Vector3(1, 0, 0.35).normalize()

// Hai pass mỗi frame:
//   1. ray march mây vào render target độ phân giải thấp (renderScale)
//   2. composite bầu trời full-res + mây đã upscale + tonemap ra màn hình
// Camera đứng ở gốc toạ độ (đơn vị mét), mặt đất là mặt cầu bán kính EARTH_R.
export class CloudRenderer {
	#renderer: THREE.WebGLRenderer
	#params: CloudParams = { ...defaultCloudParams }
	#size = new THREE.Vector2(1, 1)
	#sunDir = new THREE.Vector3()
	#wind = new THREE.Vector3() // độ dời tích luỹ của gió
	#cloudRT = new THREE.WebGLRenderTarget(1, 1, {
		depthBuffer: false,
		type: THREE.HalfFloatType,
		minFilter: THREE.LinearFilter,
		magFilter: THREE.LinearFilter,
		generateMipmaps: false,
	})
	#cloudPass
	#compositePass

	constructor(
		renderer: THREE.WebGLRenderer,
		camera: THREE.PerspectiveCamera,
		noise: NoiseTextures,
		params: Partial<CloudParams> = {}
	) {
		this.#renderer = renderer
		// camera được tham chiếu trực tiếp: uniform luôn bám theo khi camera đổi
		const view = {
			uInvProj: { value: camera.projectionMatrixInverse },
			uCamWorld: { value: camera.matrixWorld },
			uCamPos: { value: camera.position },
			uSunDir: { value: this.#sunDir },
		}
		this.#cloudPass = new FullscreenPass(common + sky + cloudsFrag, {
			...view,
			uBase: { value: noise.base.texture },
			uDetail: { value: noise.detail.texture },
			uWeather: { value: noise.weather.texture },
			uCurl: { value: noise.curl.texture },
			uWind: { value: this.#wind },
			uCoverage: { value: 0 },
			uType: { value: 0 },
			uPrecip: { value: 0 },
			uDensity: { value: 0 },
			uG: { value: 0 },
			uSunIntensity: { value: 0 },
			uAmbient: { value: 0 },
			uUseHG: { value: true },
			uUsePowder: { value: true },
			uHorizon: { value: true },
		})
		this.#compositePass = new FullscreenPass(common + sky + compositeFrag, {
			...view,
			uClouds: { value: this.#cloudRT.texture },
		})
		this.setParams(params)
	}

	get cloudSize() {
		return [this.#cloudRT.width, this.#cloudRT.height] as const
	}

	setParams(params: Partial<CloudParams>) {
		const prevScale = this.#params.renderScale
		const p = Object.assign(this.#params, params)
		const u = this.#cloudPass.uniforms
		u.uCoverage.value = p.coverage
		u.uType.value = p.cloudType
		u.uPrecip.value = p.precipitation
		u.uDensity.value = p.density
		u.uG.value = p.g
		u.uSunIntensity.value = p.sunIntensity
		u.uAmbient.value = p.ambient
		u.uUseHG.value = p.useHG
		u.uUsePowder.value = p.usePowder
		u.uHorizon.value = p.horizonCumulus
		sunDirection(p.sunElevation, p.sunAzimuth, this.#sunDir)
		if (p.renderScale !== prevScale) this.setSize(this.#size.x, this.#size.y)
	}

	// Kích thước drawing buffer của canvas
	setSize(width: number, height: number) {
		this.#size.set(width, height)
		this.#cloudRT.setSize(...cloudTargetSize(width, height, this.#params.renderScale))
	}

	render(delta: number) {
		this.#wind.addScaledVector(WIND_DIR, this.#params.windSpeed * delta)
		this.#cloudPass.render(this.#renderer, this.#cloudRT)
		this.#compositePass.render(this.#renderer, null)
	}

	dispose() {
		this.#cloudPass.dispose()
		this.#compositePass.dispose()
		this.#cloudRT.dispose()
	}
}
