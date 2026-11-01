import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { AssetLoader } from './asset-loader'
import { BatchedAsset } from './batched-asset'
import { defaultStreamingParams } from './params'
import { StreamingWorld } from './streaming-world'

const ASSETS = ['a.glb', 'b.glb', 'c.glb']
const flush = () => new Promise((r) => setTimeout(r))

// Loader giả: model gồm hai mesh con như cây thật (cành + lá), không cần WebGL
function fakeLoader() {
	const loaded: BatchedAsset[] = []
	const load = vi.fn(async () => {
		const root = new THREE.Group()
		root.add(
			new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()),
			new THREE.Mesh(new THREE.SphereGeometry(), new THREE.MeshStandardMaterial())
		)
		const asset = new BatchedAsset(root)
		loaded.push(asset)
		return asset
	})
	return { loader: { load, dispose: vi.fn() } as unknown as AssetLoader, load, loaded }
}

// gọi update như vòng lặp frame cho đến khi không còn ô đang nạp / chờ
async function settle(world: StreamingWorld, x = 0, z = 0) {
	world.update(x, z)
	for (let i = 0; i < 50 && (world.stats.loading > 0 || world.stats.queued > 0); i++) {
		await flush()
		world.update(x, z)
	}
}

const instanceCount = (assets: BatchedAsset[]) => assets.reduce((n, a) => n + a.count, 0)

describe('StreamingWorld', () => {
	const params = { ...defaultStreamingParams, maxConcurrentLoads: 3, objectsPerTile: 5 }

	it('nạp mọi ô trong tầm, mỗi model chỉ nạp một lần', async () => {
		const { loader, load, loaded } = fakeLoader()
		const world = new StreamingWorld(loader, params, ASSETS)
		await settle(world)
		expect(world.stats.ready).toBeGreaterThan(30)
		expect(load).toHaveBeenCalledTimes(ASSETS.length)
		expect(instanceCount(loaded)).toBe(world.stats.ready * params.objectsPerTile)
	})

	it('dựng lại liên tục (kéo thanh trượt) vẫn hội tụ, không rò instance', async () => {
		const { loader, load, loaded } = fakeLoader()
		const world = new StreamingWorld(loader, params, ASSETS)
		world.update(0, 0)
		for (let size = 20; size <= 30; size++) {
			world.setParams({ tileSize: size })
			world.update(0, 0)
		}
		await settle(world)
		expect(world.stats.ready).toBeGreaterThan(0)
		expect(instanceCount(loaded)).toBe(world.stats.ready * params.objectsPerTile)
		// model giữ lại trong cache khi dựng lại, không nạp lại
		expect(load).toHaveBeenCalledTimes(ASSETS.length)
	})

	it('đi xa: ô cũ bị huỷ và trả lại instance', async () => {
		const { loader, loaded } = fakeLoader()
		const world = new StreamingWorld(loader, params, ASSETS)
		await settle(world)
		const before = world.stats.ready
		await settle(world, 5000, 0)
		expect(world.stats.ready).toBe(before)
		expect(instanceCount(loaded)).toBe(world.stats.ready * params.objectsPerTile)
	})

	it('dispose() huỷ mọi model kể cả khi ô đang nạp dở', async () => {
		const { loader, loaded } = fakeLoader()
		const world = new StreamingWorld(loader, params, ASSETS)
		world.update(0, 0)
		world.dispose()
		await flush()
		await flush()
		expect(loaded.length).toBeGreaterThan(0)
		expect(loaded.every((a) => a.meshes.length === 0)).toBe(true)
		expect(instanceCount(loaded)).toBe(0)
	})
})
