import * as THREE from 'three'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'
import { BatchedAsset } from './batched-asset'

// decoder WASM chép từ three/examples/jsm/libs vào static/libs (cùng phiên bản three)
const DRACO_PATH = '/libs/draco/'
const BASIS_PATH = '/libs/basis/'

export type WarmTarget = { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.Camera }

// Nạp glTF (Draco + KTX2) thành BatchedAsset đã "làm nóng": shader đã biên dịch và texture đã lên GPU,
// nên lần đầu cây xuất hiện không bị khựng frame.
export class AssetLoader {
	#gltf = new GLTFLoader()
	#draco = new DRACOLoader()
	#ktx2 = new KTX2Loader()
	#warm: WarmTarget

	constructor(warm: WarmTarget) {
		this.#warm = warm
		this.#draco.setDecoderPath(DRACO_PATH)
		this.#ktx2.setTranscoderPath(BASIS_PATH).detectSupport(warm.renderer)
		this.#gltf.setDRACOLoader(this.#draco).setKTX2Loader(this.#ktx2)
	}

	async load(url: string) {
		const gltf = await this.#gltf.loadAsync(url)
		const asset = new BatchedAsset(gltf.scene)
		try {
			await this.#prepare(asset)
		} catch (e) {
			asset.dispose()
			throw e
		}
		return asset
	}

	dispose() {
		this.#draco.dispose()
		this.#ktx2.dispose()
	}

	async #prepare(asset: BatchedAsset) {
		const { renderer, scene, camera } = this.#warm
		// biên dịch với chính BatchedMesh (shader có define BATCHING), không phải mesh glTF gốc
		await renderer.compileAsync(asset.object, camera, scene)
		for (const mesh of asset.meshes) {
			for (const value of Object.values(mesh.material)) {
				if (value instanceof THREE.Texture) renderer.initTexture(value)
			}
		}
	}
}
