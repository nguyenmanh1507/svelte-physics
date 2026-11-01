import * as THREE from 'three'
import { createGrassGeometry, setGrassBounds } from './grass-geometry'
import type { GrassParams } from './params'
import type { SharedUniforms } from './shared-uniforms'
import common from './shaders/common.glsl?raw'
import noise from './shaders/noise.glsl?raw'
import terrain from './shaders/terrain.glsl?raw'
import grassVert from './shaders/grass.vert?raw'
import grassFrag from './shaders/grass.frag?raw'

type GrassTextureSet = { tileData: THREE.Texture; bladeDiffuse: THREE.DataArrayTexture }

// Toàn bộ lá cỏ trong một draw call (instancing, không attribute)
export class Grass {
	readonly mesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>

	#segments: number
	#windSpeed = 1
	#u = {
		grassParams: { value: new THREE.Vector4() },
		windParams: { value: new THREE.Vector2() }, // x = độ nghiêng, y = thời gian gió
	}

	constructor(shared: SharedUniforms, textures: GrassTextureSet, params: GrassParams) {
		const material = new THREE.ShaderMaterial({
			uniforms: {
				...this.#u,
				terrainParams: shared.terrainParams,
				tileDataTexture: { value: textures.tileData },
				grassDiffuse: { value: textures.bladeDiffuse },
			},
			vertexShader: common + noise + terrain + grassVert,
			fragmentShader: common + grassFrag,
		})
		this.#segments = params.segments
		const geometry = createGrassGeometry(params.segments, params.bladeCount, params.patchSize)
		this.mesh = new THREE.Mesh(geometry, material)
		this.setParams(params)
	}

	setParams(p: GrassParams) {
		// index buffer phụ thuộc số đoạn -> dựng lại; còn lại chỉ là số / uniform
		if (p.segments !== this.#segments) {
			this.mesh.geometry.dispose()
			this.mesh.geometry = createGrassGeometry(p.segments, p.bladeCount, p.patchSize)
			this.#segments = p.segments
		}
		const geometry = this.mesh.geometry
		geometry.instanceCount = p.bladeCount
		setGrassBounds(geometry, p.patchSize)

		this.#u.grassParams.value.set(p.segments, p.patchSize, p.bladeWidth, p.bladeHeight)
		this.#u.windParams.value.x = p.windStrength
		this.#windSpeed = p.windSpeed
	}

	// thời gian gió tích luỹ theo tốc độ: đổi tốc độ không làm cỏ giật
	update(delta: number) {
		this.#u.windParams.value.y += delta * this.#windSpeed
	}

	dispose() {
		this.mesh.geometry.dispose()
		this.mesh.material.dispose()
	}
}
