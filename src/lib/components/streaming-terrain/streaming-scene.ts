import * as THREE from 'three'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'
import { AssetLoader } from './asset-loader'
import { FOLIAGE_ASSETS, SKYBOX_URL } from './assets'
import { defaultStreamingParams, type StreamingParams } from './params'
import { StreamingWorld } from './streaming-world'
import { SunRig } from './sun-rig'
import { heightAt } from './terrain'

// Bầu trời HDR + mặt trời đi theo + thế giới streaming trong một THREE.Scene.
//   const world = await StreamingScene.create(renderer, camera, params)
//   mỗi frame: world.update(player.position); renderer.render(world.scene, camera)
export class StreamingScene {
	readonly scene = new THREE.Scene()
	readonly world: StreamingWorld

	#loader: AssetLoader
	#sun = new SunRig()
	#environment: THREE.Texture

	static async create(
		renderer: THREE.WebGLRenderer,
		camera: THREE.Camera,
		params: Partial<StreamingParams> = {}
	) {
		const environment = await new HDRLoader().loadAsync(SKYBOX_URL)
		environment.mapping = THREE.EquirectangularReflectionMapping
		return new StreamingScene(renderer, camera, environment, params)
	}

	private constructor(
		renderer: THREE.WebGLRenderer,
		camera: THREE.Camera,
		environment: THREE.Texture,
		params: Partial<StreamingParams>
	) {
		const scene = this.scene
		this.#environment = environment
		scene.background = scene.environment = environment
		scene.backgroundBlurriness = 0.6
		scene.backgroundIntensity = 0.5
		scene.environmentIntensity = 0.25
		this.#sun.addTo(scene)

		this.#loader = new AssetLoader({ renderer, scene, camera })
		this.world = new StreamingWorld(
			this.#loader,
			{ ...defaultStreamingParams, ...params },
			FOLIAGE_ASSETS
		)
		scene.add(this.world.object)
	}

	get params() {
		return this.world.params
	}

	setParams(params: Partial<StreamingParams>) {
		this.world.setParams(params)
	}

	// Độ cao mặt đất (m) tại (x, z), khớp với mặt đất đang vẽ
	heightAt(x: number, z: number) {
		return heightAt(x, z, this.world.params)
	}

	// focus: vị trí nhân vật, ô được nạp và bóng đổ quanh điểm này
	update(focus: THREE.Vector3) {
		this.#sun.follow(focus)
		this.world.update(focus.x, focus.z)
	}

	dispose() {
		this.world.dispose()
		this.#loader.dispose()
		this.#sun.dispose()
		this.#environment.dispose()
	}
}
