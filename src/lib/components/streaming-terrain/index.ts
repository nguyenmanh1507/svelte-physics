// Thế giới streaming theo ô: ô quanh nhân vật được nạp, ô ở xa bị huỷ.
// Port từ SimonDev Three.js course, 03-05 Streaming.
export { default as StreamingView } from './streaming-view.svelte'
export { StreamingScene } from './streaming-scene'
export { StreamingWorld, type StreamingWorldStats } from './streaming-world'
export { StreamingTile, type TileContext } from './streaming-tile'
export { TileStreamer, type StreamedTile, type TileStreamerOptions } from './tile-streamer'
export { AssetCache, type AssetCacheStats, type Disposable } from './asset-cache'
export { AssetLoader } from './asset-loader'
export { BatchedAsset } from './batched-asset'
export { SunRig } from './sun-rig'
export { FOLIAGE_ASSETS, SKYBOX_URL } from './assets'
export {
	planStreaming,
	tileCenter,
	tileKey,
	tileOf,
	tilesInRadius,
	type TileCoord,
	type TileRef,
} from './tile-grid'
export { scatterTile, type Placement } from './scatter'
export { createGroundGeometry, heightAt, normalAt } from './terrain'
export { createRandom, hash2, noise2 } from './noise'
export { defaultStreamingParams, needsRebuild, REBUILD_KEYS, type StreamingParams } from './params'
