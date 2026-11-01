import * as THREE from 'three'
import type { SharedUniforms } from './shared-uniforms'
import common from './shaders/common.glsl?raw'
import noise from './shaders/noise.glsl?raw'
import terrain from './shaders/terrain.glsl?raw'
import groundVert from './shaders/ground.vert?raw'
import groundFrag from './shaders/ground.frag?raw'

const GROUND_SIZE = 500 // m, cạnh mặt phẳng
const GROUND_SEGMENTS = 512 // đủ dày để vertex shader nâng theo địa hình

// Mặt đất lưới, vertex shader nâng theo cùng hàm địa hình với gốc cỏ
export class Ground {
	readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>

	constructor(shared: SharedUniforms, gridTexture: THREE.Texture) {
		const material = new THREE.ShaderMaterial({
			uniforms: {
				terrainParams: shared.terrainParams,
				diffuseTexture: { value: gridTexture },
			},
			vertexShader: noise + terrain + groundVert,
			fragmentShader: common + groundFrag,
		})
		const geometry = new THREE.PlaneGeometry(1, 1, GROUND_SEGMENTS, GROUND_SEGMENTS)
		this.mesh = new THREE.Mesh(geometry, material)
		this.mesh.rotateX(-Math.PI / 2)
		this.mesh.scale.setScalar(GROUND_SIZE)
		// bounds của mặt phẳng phẳng lì, địa hình nâng lên trong shader -> không cull
		this.mesh.frustumCulled = false
	}

	dispose() {
		this.mesh.geometry.dispose()
		this.mesh.material.dispose()
	}
}
