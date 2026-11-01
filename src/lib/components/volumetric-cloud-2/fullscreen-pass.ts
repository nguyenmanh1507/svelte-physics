import * as THREE from 'three'
import vertexShader from './shaders/fullscreen.vert?raw'

// Một tam giác phủ kín màn hình, dùng chung cho mọi pass
const triangle = new THREE.BufferGeometry()
triangle.setAttribute(
	'position',
	new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)
)
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

type Target = THREE.WebGLRenderTarget | THREE.WebGL3DRenderTarget | null

// Vẽ một fragment shader lên toàn bộ render target (hoặc một lớp z của target 3D).
export class FullscreenPass<U extends Record<string, THREE.IUniform>> {
	readonly uniforms: U
	readonly #material: THREE.RawShaderMaterial
	readonly #scene = new THREE.Scene()

	constructor(fragmentShader: string, uniforms: U) {
		this.uniforms = uniforms
		this.#material = new THREE.RawShaderMaterial({
			glslVersion: THREE.GLSL3,
			vertexShader,
			fragmentShader,
			uniforms,
			depthTest: false,
			depthWrite: false,
		})
		const mesh = new THREE.Mesh(triangle, this.#material)
		mesh.frustumCulled = false
		this.#scene.add(mesh)
	}

	render(renderer: THREE.WebGLRenderer, target: Target, layer = 0) {
		renderer.setRenderTarget(target, layer)
		renderer.render(this.#scene, camera)
	}

	dispose() {
		this.#material.dispose()
	}
}
