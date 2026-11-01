import * as THREE from 'three'
import { Grass } from './grass'
import { Ground } from './ground'
import { defaultGrassParams, type GrassParams } from './params'
import { createSharedUniforms } from './shared-uniforms'
import { Sky } from './sky'
import { terrainHeight } from './terrain'
import { disposeGrassTextures, loadGrassTextures, type GrassTextures } from './textures'
import { TrampleMap, type Interactor } from './trample-map'

// Ghép sky + ground + grass vào một THREE.Scene và giữ uniform dùng chung.
//   const world = await GrassScene.create(params)
//   world.addInteractor(player)                   // vật đè cỏ (tuỳ chọn)
//   mỗi frame: world.update(delta, renderer); renderer.render(world.scene, camera)
export class GrassScene {
	readonly scene = new THREE.Scene()
	readonly params: GrassParams

	#shared = createSharedUniforms()
	#textures: GrassTextures
	#trample = new TrampleMap()
	#interactors: Interactor[] = []
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
		this.#grass = new Grass(this.#shared, this.#trample, textures, this.params)
		this.scene.add(this.#sky.mesh, this.#ground.mesh, this.#grass.mesh)

		// đèn chỉ cho vật thể dùng material thường (vd. nhân vật); cỏ / đất / trời tự tính sáng.
		// Cùng hướng với LIGHT_DIR trong grass.frag.
		const sun = new THREE.DirectionalLight(0xffffff, 2)
		sun.position.set(-1, 0.5, 1)
		this.scene.add(sun, new THREE.HemisphereLight(0xffffbf, 0x0d0d40, 1.5))

		this.setParams(this.params)
	}

	setParams(params: Partial<GrassParams>) {
		const p = Object.assign(this.params, params)
		this.#shared.terrainParams.value.set(p.terrainFrequency, p.terrainHeight)
		this.#grass.setParams(p)
		// trample map phủ đúng vùng cỏ
		this.#trample.configure(0, 0, p.patchSize, p.trampleBend, p.trampleRecovery)
	}

	// Độ cao mặt đất (m) tại (x, z), khớp với địa hình GPU đang vẽ
	heightAt(x: number, z: number) {
		return terrainHeight(x, z, this.params.terrainFrequency, this.params.terrainHeight)
	}

	addInteractor(interactor: Interactor) {
		this.#interactors.push(interactor)
	}

	removeInteractor(interactor: Interactor) {
		this.#interactors = this.#interactors.filter((i) => i !== interactor)
	}

	// kích thước drawing buffer (px), sky tô gradient theo toạ độ màn hình
	setSize(width: number, height: number) {
		this.#shared.resolution.value.set(width, height)
	}

	// cần renderer để cập nhật trample map (một pass nhỏ trên GPU) trước khi vẽ cỏ
	update(delta: number, renderer: THREE.WebGLRenderer) {
		this.#grass.update(delta)
		this.#trample.update(renderer, delta, this.#interactors)
	}

	dispose() {
		this.#sky.dispose()
		this.#ground.dispose()
		this.#grass.dispose()
		this.#trample.dispose()
		disposeGrassTextures(this.#textures)
	}
}
