import * as THREE from 'three'
import { Grass } from './grass'
import { Ground } from './ground'
import { defaultGrassParams, type GrassParams } from './params'
import { createSharedUniforms } from './shared-uniforms'
import { Sky } from './sky'
import { disposeGrassTextures, loadGrassTextures, type GrassTextures } from './textures'

// Ghép sky + ground + grass vào một THREE.Scene và giữ uniform dùng chung.
//   const world = await GrassScene.create(params)
//   mỗi frame: world.update(delta); renderer.render(world.scene, camera)
export class GrassScene {
	readonly scene = new THREE.Scene()
	readonly params: GrassParams

	#shared = createSharedUniforms()
	#textures: GrassTextures
	#sky: Sky
	#ground: Ground
	#grass: Grass

	static async create(params: Partial<GrassParams> = {}) {
		return new GrassScene(await loadGrassTextures(), params)
	}

	private constructor(textures: GrassTextures, params: Partial<GrassParams>) {
		this.params = { ...defaultGrassParams, ...params }
		this.#textures = textures
		this.#sky = new Sky(this.#shared)
		this.#ground = new Ground(this.#shared, textures.grid)
		this.#grass = new Grass(this.#shared, textures, this.params)
		this.scene.add(this.#sky.mesh, this.#ground.mesh, this.#grass.mesh)
		this.setParams(this.params)
	}

	setParams(params: Partial<GrassParams>) {
		const p = Object.assign(this.params, params)
		this.#shared.terrainParams.value.set(p.terrainFrequency, p.terrainHeight)
		this.#grass.setParams(p)
	}

	// kích thước drawing buffer (px), sky tô gradient theo toạ độ màn hình
	setSize(width: number, height: number) {
		this.#shared.resolution.value.set(width, height)
	}

	update(delta: number) {
		this.#grass.update(delta)
	}

	dispose() {
		this.#sky.dispose()
		this.#ground.dispose()
		this.#grass.dispose()
		disposeGrassTextures(this.#textures)
	}
}
