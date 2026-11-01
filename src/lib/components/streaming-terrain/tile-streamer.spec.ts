import { describe, expect, it, vi } from 'vitest'
import type { TileRef } from './tile-grid'
import { TileStreamer } from './tile-streamer'

// Ô giả: load() chờ đến khi test gọi finish()
class FakeTile {
	disposed = false
	finish!: () => void
	constructor(readonly ref: TileRef) {}
	load = vi.fn(() => new Promise<void>((resolve) => (this.finish = resolve)))
	dispose = vi.fn(() => (this.disposed = true))
}

const OPTIONS = { tileSize: 20, loadRadius: 30, unloadRadius: 40, maxConcurrent: 2 }
const flush = () => new Promise((r) => setTimeout(r))

function setup() {
	const created: FakeTile[] = []
	const streamer = new TileStreamer((ref) => {
		const tile = new FakeTile(ref)
		created.push(tile)
		return tile
	}, OPTIONS)
	return { streamer, created }
}

describe('TileStreamer', () => {
	it('nạp tối đa maxConcurrent ô cùng lúc, ô gần nhất trước', async () => {
		const { streamer, created } = setup()
		streamer.update(0, 0)
		expect(created.map((t) => t.ref.key)[0]).toBe('0,0')
		expect(created).toHaveLength(2)
		expect(streamer.stats.loading).toBe(2)

		created[0].finish()
		await flush()
		streamer.update(0, 0)
		expect(created).toHaveLength(3)
		expect(streamer.stats.ready).toBe(1)
	})

	it('ô ra khỏi tầm trước khi tới lượt thì không bao giờ được tạo', async () => {
		const { streamer, created } = setup()
		streamer.update(0, 0)
		streamer.update(1000, 0) // chạy đi rất xa
		created.forEach((t) => t.finish())
		await flush()
		streamer.update(1000, 0)
		const far = created.filter((t) => Math.hypot(t.ref.x * 20 - 1000, t.ref.z * 20) > 30)
		expect(far.every((t) => t.disposed)).toBe(true)
		expect(far).toHaveLength(2) // chỉ hai ô đã bắt đầu nạp ở gốc
	})

	it('huỷ ô đang nạp dở vẫn trả lại chỗ trong giới hạn song song', async () => {
		const { streamer, created } = setup()
		streamer.update(0, 0)
		streamer.update(1000, 0)
		expect(created.slice(0, 2).every((t) => t.disposed)).toBe(true)
		expect(streamer.stats.loading).toBe(2) // load() của chúng chưa kết thúc

		created[0].finish()
		created[1].finish()
		await flush()
		streamer.update(1000, 0)
		expect(streamer.stats.loading).toBe(2)
		expect(created.slice(2).every((t) => !t.disposed)).toBe(true)
	})

	it('clear() huỷ mọi ô rồi nạp lại ở lần update sau', async () => {
		const { streamer, created } = setup()
		streamer.update(0, 0)
		created.forEach((t) => t.finish())
		await flush()
		streamer.clear()
		expect(created.every((t) => t.disposed)).toBe(true)
		streamer.update(0, 0)
		expect(created.filter((t) => !t.disposed).length).toBeGreaterThan(0)
	})
})
