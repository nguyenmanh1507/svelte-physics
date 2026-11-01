import * as THREE from 'three'
import vertexShader from './shaders/trample.vert?raw'
import fragmentShader from './shaders/trample.frag?raw'

const SIZE = 256 // texel mỗi cạnh: vùng 100 m -> ~0,4 m mỗi texel
export const MAX_INTERACTORS = 8

// Bất cứ thứ gì đè lên cỏ: nhân vật, xe, quả bóng… chỉ cần vị trí (world) và bán kính.
export interface Interactor {
	readonly position: THREE.Vector3
	readonly trampleRadius: number
}

// Hệ số nhân mỗi frame để sau `recovery` giây độ đè còn ~5% (e^-3)
export function trampleDecay(delta: number, recovery: number) {
	return recovery > 0 ? Math.exp((-3 * delta) / recovery) : 0
}

// Texture vùng quanh tâm `area`, lưu hướng × độ đè cỏ (xem shaders/trample.frag).
// Hai render target thay phiên nhau: đọc frame trước, ghi frame này.
// Cỏ đọc qua `uniforms` (trampleMap, trampleParams) trong grass.vert.
export class TrampleMap {
	readonly uniforms = {
		trampleMap: { value: null as THREE.Texture | null },
		trampleParams: { value: new THREE.Vector4(0, 0, 1, 0) }, // tâm x, z, nửa cạnh, góc đè tối đa
	}

	#targets: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget]
	#material: THREE.ShaderMaterial
	#scene = new THREE.Scene()
	#camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
	#quad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
	#recovery = 1

	constructor() {
		const target = () =>
			new THREE.WebGLRenderTarget(SIZE, SIZE, {
				type: THREE.HalfFloatType, // hướng có dấu âm -> cần float
				depthBuffer: false,
				minFilter: THREE.LinearFilter,
				magFilter: THREE.LinearFilter,
				generateMipmaps: false,
			})
		this.#targets = [target(), target()]
		this.uniforms.trampleMap.value = this.#targets[0].texture

		this.#material = new THREE.ShaderMaterial({
			defines: { MAX_INTERACTORS },
			uniforms: {
				previous: { value: null },
				area: { value: new THREE.Vector3(0, 0, 1) },
				decay: { value: 1 },
				interactors: {
					value: Array.from({ length: MAX_INTERACTORS }, () => new THREE.Vector4()),
				},
				interactorCount: { value: 0 },
			},
			vertexShader,
			fragmentShader,
			depthTest: false,
			depthWrite: false,
		})
		this.#quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.#material)
		this.#quad.frustumCulled = false
		this.#scene.add(this.#quad)
	}

	// Vùng phủ của map (tâm x, z và nửa cạnh, m), góc đè tối đa (rad), thời gian cỏ đứng dậy (s)
	configure(centerX: number, centerZ: number, halfSize: number, maxBend: number, recovery: number) {
		this.uniforms.trampleParams.value.set(centerX, centerZ, halfSize, maxBend)
		this.#material.uniforms.area.value.set(centerX, centerZ, halfSize)
		this.#recovery = recovery
	}

	update(renderer: THREE.WebGLRenderer, delta: number, interactors: readonly Interactor[]) {
		const u = this.#material.uniforms
		const count = Math.min(interactors.length, MAX_INTERACTORS)
		for (let i = 0; i < count; i++) {
			const { position, trampleRadius } = interactors[i]
			u.interactors.value[i].set(position.x, position.z, trampleRadius, 0)
		}
		u.interactorCount.value = count
		u.decay.value = trampleDecay(delta, this.#recovery)

		const [read, write] = this.#targets
		u.previous.value = read.texture
		const prevTarget = renderer.getRenderTarget()
		renderer.setRenderTarget(write)
		renderer.render(this.#scene, this.#camera)
		renderer.setRenderTarget(prevTarget)

		this.#targets = [write, read]
		this.uniforms.trampleMap.value = write.texture
	}

	dispose() {
		this.#targets.forEach((t) => t.dispose())
		this.#quad.geometry.dispose()
		this.#material.dispose()
	}
}
