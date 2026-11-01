import * as THREE from 'three'
import { AssetCache, type AssetCacheStats } from './asset-cache'
import type { AssetLoader } from './asset-loader'
import type { BatchedAsset } from './batched-asset'
import { needsRebuild, type StreamingParams } from './params'
import { StreamingTile } from './streaming-tile'
import { TileStreamer, type TileStreamerOptions, type TileStreamerStats } from './tile-streamer'

export type StreamingWorldStats = TileStreamerStats & { assets: AssetCacheStats }

const streamerOptions = (p: StreamingParams): TileStreamerOptions => ({
	tileSize: p.tileSize,
	loadRadius: p.loadRadius,
	unloadRadius: p.loadRadius + p.unloadMargin,
	maxConcurrent: p.maxConcurrentLoads,
})

// Ghép TileStreamer (ô nào sống) + AssetCache (model dùng chung) + StreamingTile (nội dung ô).
//   const world = new StreamingWorld(loader, params, FOLIAGE_ASSETS)
//   scene.add(world.object)
//   mỗi frame: world.update(x, z)
export class StreamingWorld {
	readonly object = new THREE.Group()
	readonly params: StreamingParams

	#ground = new THREE.Group()
	#cache: AssetCache<BatchedAsset>
	#streamer: TileStreamer<StreamingTile>

	constructor(loader: AssetLoader, params: StreamingParams, assets: readonly string[]) {
		this.params = { ...params }
		this.object.name = 'streaming world'
		this.object.add(this.#ground)

		this.#cache = new AssetCache(
			async (url) => {
				const asset = await loader.load(url)
				this.object.add(asset.object)
				return asset
			},
			// đủ chỗ giữ mọi model khi đổi thông số (dựng lại ô) mà không phải nạp lại
			{ maxIdle: assets.length }
		)

		const ctx = { parent: this.#ground, cache: this.#cache, assets, params: this.params }
		this.#streamer = new TileStreamer((ref) => new StreamingTile(ref, ctx), streamerOptions(params))
	}

	get stats(): StreamingWorldStats {
		return { ...this.#streamer.stats, assets: this.#cache.stats }
	}

	setParams(next: Partial<StreamingParams>) {
		const prev = { ...this.params }
		const p = Object.assign(this.params, next)
		this.#streamer.setOptions(streamerOptions(p))
		if (needsRebuild(prev, p)) this.#streamer.clear()
		else if (prev.tintTiles !== p.tintTiles) {
			for (const tile of this.#streamer.tiles) tile.setTint(p.tintTiles)
		}
	}

	// (x, z): vị trí nhân vật, ô được nạp quanh điểm này
	update(x: number, z: number) {
		this.#streamer.update(x, z)
	}

	dispose() {
		// huỷ ô trước để chúng trả tham chiếu, rồi mới huỷ model trong cache
		this.#streamer.clear()
		this.#cache.dispose()
		this.object.removeFromParent()
	}
}
