import * as THREE from 'three'
import type { AssetCache } from './asset-cache'
import type { BatchedAsset } from './batched-asset'
import { hash2 } from './noise'
import type { StreamingParams } from './params'
import { scatterTile, type Placement } from './scatter'
import { createGroundGeometry, heightAt } from './terrain'
import { tileCenter, type TileRef } from './tile-grid'
import type { StreamedTile } from './tile-streamer'

export type TileContext = {
	parent: THREE.Object3D // nơi gắn mặt đất của ô
	cache: AssetCache<BatchedAsset>
	assets: readonly string[] // url model, `Placement.asset` là chỉ số trong mảng này
	params: StreamingParams
}

const GROUND_COLOR = new THREE.Color(0x6b7a3a)
const _matrix = new THREE.Matrix4()
const _position = new THREE.Vector3()
const _rotation = new THREE.Quaternion()
const _scale = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)

// Một ô thế giới: mặt đất (sở hữu riêng) + các instance cây trong BatchedAsset dùng chung.
// Ô không bao giờ dispose geometry / material của model: chỉ giữ tham chiếu qua cache và trả lại khi huỷ.
export class StreamingTile implements StreamedTile {
	readonly ref: TileRef
	readonly ground: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>

	#ctx: TileContext
	#placements: Placement[]
	#acquired: { url: string; asset: BatchedAsset }[] = []
	#instances: { asset: BatchedAsset; id: number }[] = []
	#disposed = false

	constructor(ref: TileRef, ctx: TileContext) {
		this.ref = ref
		this.#ctx = ctx
		const p = ctx.params

		// mặt đất hiện ngay để không có lỗ thủng; cây hiện sau khi model nạp xong
		this.ground = new THREE.Mesh(
			createGroundGeometry(ref, p),
			new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 })
		)
		const center = tileCenter(ref, p.tileSize)
		this.ground.position.set(center.x, 0, center.z)
		this.ground.receiveShadow = true
		this.ground.name = `tile ${ref.key}`
		this.setTint(p.tintTiles)
		ctx.parent.add(this.ground)

		this.#placements = scatterTile(ref, {
			tileSize: p.tileSize,
			count: p.objectsPerTile,
			assetCount: ctx.assets.length,
			scale: p.objectScale,
			heightAt: (x, z) => heightAt(x, z, p),
		})
	}

	get disposed() {
		return this.#disposed
	}

	// tô màu riêng cho ô (debug) hoặc trả về màu đất
	setTint(on: boolean) {
		const color = this.ground.material.color
		if (on) color.setHSL((hash2(this.ref.x, this.ref.z, 7) % 360) / 360, 0.7, 0.5)
		else color.copy(GROUND_COLOR)
	}

	async load() {
		const { cache, assets } = this.#ctx
		const urls = [...new Set(this.#placements.map((p) => assets[p.asset]))]
		const results = await Promise.allSettled(urls.map((url) => cache.acquire(url)))

		// mọi acquire thành công phải được release đúng một lần, kể cả khi ô đã bị huỷ trong lúc chờ
		const byUrl = new Map<string, BatchedAsset>()
		results.forEach((r, i) => {
			if (r.status === 'fulfilled') {
				this.#acquired.push({ url: urls[i], asset: r.value })
				byUrl.set(urls[i], r.value)
			} else {
				console.error(`Không nạp được ${urls[i]}`, r.reason)
			}
		})
		if (this.#disposed) return this.#releaseAssets()

		for (const p of this.#placements) {
			const asset = byUrl.get(assets[p.asset])
			if (!asset) continue
			_position.set(p.x, p.y, p.z)
			_rotation.setFromAxisAngle(UP, p.rotation)
			_scale.setScalar(p.scale)
			this.#instances.push({ asset, id: asset.add(_matrix.compose(_position, _rotation, _scale)) })
		}
	}

	dispose() {
		if (this.#disposed) return
		this.#disposed = true
		for (const { asset, id } of this.#instances) asset.remove(id)
		this.#instances = []
		this.#releaseAssets()
		this.ground.removeFromParent()
		this.ground.geometry.dispose()
		this.ground.material.dispose()
	}

	#releaseAssets() {
		for (const { url } of this.#acquired) this.#ctx.cache.release(url)
		this.#acquired = []
	}
}
