import * as THREE from 'three'
import { FullscreenPass } from './fullscreen-pass'
import common from './shaders/common.glsl?raw'
import noise from './shaders/noise.glsl?raw'
import baseNoise from './shaders/base-noise.frag?raw'
import detailNoise from './shaders/detail-noise.frag?raw'
import curlNoise from './shaders/curl.frag?raw'
import weatherNoise from './shaders/weather.frag?raw'

const BASE_SIZE = 128
const DETAIL_SIZE = 32
const CURL_SIZE = 128
const WEATHER_SIZE = 512

function setupTexture(t: THREE.Texture | THREE.Data3DTexture) {
	t.minFilter = t.magFilter = THREE.LinearFilter
	t.generateMipmaps = false
	t.wrapS = t.wrapT = THREE.RepeatWrapping
	if ('wrapR' in t) t.wrapR = THREE.RepeatWrapping
}

function make3DTarget(size: number) {
	const rt = new THREE.WebGL3DRenderTarget(size, size, size, { depthBuffer: false })
	setupTexture(rt.texture)
	return rt
}

function make2DTarget(size: number) {
	const rt = new THREE.WebGLRenderTarget(size, size, { depthBuffer: false })
	setupTexture(rt.texture)
	return rt
}

// Các texture noise tileable của mây [slide 32-35, 42], tạo trên GPU lúc khởi động.
// Việc tạo được chia thành nhiều job nhỏ (mỗi lớp z một job) để chạy rải qua nhiều frame,
// tránh treo GPU: gọi bake() mỗi frame cho tới khi ready.
export class NoiseTextures {
	readonly base = make3DTarget(BASE_SIZE) // R = Perlin-Worley, GBA = Worley fBm
	readonly detail = make3DTarget(DETAIL_SIZE) // Worley fBm tần số cao → erosion
	readonly curl = make2DTarget(CURL_SIZE) // làm méo detail
	readonly weather = make2DTarget(WEATHER_SIZE) // R coverage, G precipitation, B type

	#renderer: THREE.WebGLRenderer
	#jobs: (() => void)[] = []
	#total: number
	#passes: FullscreenPass<Record<string, THREE.IUniform>>[]

	constructor(renderer: THREE.WebGLRenderer) {
		this.#renderer = renderer
		const prefix = common + noise
		const basePass = new FullscreenPass(prefix + baseNoise, {
			uZ: { value: 0 },
			uSize: { value: BASE_SIZE },
		})
		const detailPass = new FullscreenPass(prefix + detailNoise, {
			uZ: { value: 0 },
			uSize: { value: DETAIL_SIZE },
		})
		const curlPass = new FullscreenPass(prefix + curlNoise, { uSize: { value: CURL_SIZE } })
		const weatherPass = new FullscreenPass(prefix + weatherNoise, {
			uSize: { value: WEATHER_SIZE },
		})
		this.#passes = [basePass, detailPass, curlPass, weatherPass]

		const slices = (pass: typeof basePass, target: THREE.WebGL3DRenderTarget, size: number) => {
			for (let z = 0; z < size; z++) {
				this.#jobs.push(() => {
					pass.uniforms.uZ.value = (z + 0.5) / size
					pass.render(renderer, target, z)
				})
			}
		}
		slices(basePass, this.base, BASE_SIZE)
		slices(detailPass, this.detail, DETAIL_SIZE)
		this.#jobs.push(() => curlPass.render(renderer, this.curl))
		this.#jobs.push(() => weatherPass.render(renderer, this.weather))
		this.#total = this.#jobs.length
	}

	get ready() {
		return this.#jobs.length === 0
	}

	get progress() {
		return 1 - this.#jobs.length / this.#total
	}

	// Chạy job cho tới khi hết ngân sách thời gian (ms) của frame này
	bake(budgetMs = 12) {
		const t0 = performance.now()
		while (this.#jobs.length && performance.now() - t0 < budgetMs) this.#jobs.shift()!()
		this.#renderer.setRenderTarget(null)
		if (this.ready) this.#disposePasses()
	}

	dispose() {
		this.#disposePasses()
		for (const rt of [this.base, this.detail, this.curl, this.weather]) rt.dispose()
	}

	#disposePasses() {
		for (const pass of this.#passes) pass.dispose()
		this.#passes = []
	}
}
