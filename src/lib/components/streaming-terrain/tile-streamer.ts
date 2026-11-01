import { planStreaming, type StreamingPlanOptions, type TileCoord, type TileRef } from './tile-grid'

export interface StreamedTile {
	load(): Promise<void>
	dispose(): void
}

export type TileStreamerOptions = StreamingPlanOptions & {
	maxConcurrent: number
}

export type TileStreamerStats = { ready: number; loading: number; queued: number }

// Quản lý vòng đời ô, không phụ thuộc three.js (ô do `createTile` tạo ra):
//  - chỉ lập kế hoạch lại khi vị trí đổi đáng kể hoặc có ô nạp xong
//  - hàng đợi xếp ô gần trước và được lập lại mỗi lần, nên ô đã ra khỏi tầm trước khi tới lượt
//    thì không bao giờ được nạp
//  - giới hạn số ô nạp song song để không dồn hàng chục request cùng một frame
//  - ô bị huỷ trong lúc đang nạp vẫn được trừ khỏi số ô đang nạp khi load() kết thúc
export class TileStreamer<T extends StreamedTile> {
	#createTile: (ref: TileRef) => T
	#options: TileStreamerOptions
	#tiles = new Map<string, { coord: TileCoord; tile: T; ready: boolean }>()
	#queue: TileRef[] = []
	#loading = 0
	#last: { x: number; z: number } | null = null
	#dirty = true

	onError: (error: unknown) => void = (e) => console.error('Không nạp được ô', e)

	constructor(createTile: (ref: TileRef) => T, options: TileStreamerOptions) {
		this.#createTile = createTile
		this.#options = { ...options }
	}

	get stats(): TileStreamerStats {
		let ready = 0
		for (const t of this.#tiles.values()) if (t.ready) ready++
		return { ready, loading: this.#loading, queued: this.#queue.length }
	}

	get tiles(): T[] {
		return [...this.#tiles.values()].map((t) => t.tile)
	}

	setOptions(options: Partial<TileStreamerOptions>) {
		Object.assign(this.#options, options)
		this.#dirty = true
	}

	update(x: number, z: number) {
		const last = this.#last
		// đi chưa tới 1/4 ô thì kế hoạch cũ vẫn đúng, đỡ cấp phát mỗi frame
		const moved = !last || Math.hypot(x - last.x, z - last.z) > this.#options.tileSize / 4
		if (moved || this.#dirty) this.#replan(x, z)
		this.#pump()
	}

	// Huỷ mọi ô (vd. khi đổi thông số địa hình); lần update sau nạp lại từ đầu
	clear() {
		for (const t of this.#tiles.values()) t.tile.dispose()
		this.#tiles.clear()
		this.#queue = []
		this.#dirty = true
	}

	#replan(x: number, z: number) {
		this.#last = { x, z }
		this.#dirty = false
		const existing = new Map([...this.#tiles].map(([k, t]) => [k, t.coord]))
		const { load, unload } = planStreaming(x, z, existing, this.#options)
		for (const key of unload) {
			this.#tiles.get(key)?.tile.dispose()
			this.#tiles.delete(key)
		}
		this.#queue = load
	}

	#pump() {
		while (this.#loading < this.#options.maxConcurrent && this.#queue.length > 0) {
			const ref = this.#queue.shift()!
			const tile = this.#createTile(ref)
			const record = { coord: { x: ref.x, z: ref.z }, tile, ready: false }
			this.#tiles.set(ref.key, record)
			this.#loading++
			tile
				.load()
				.then(
					() => (record.ready = true),
					(e) => this.onError(e)
				)
				.finally(() => {
					this.#loading--
					// có chỗ trống -> lần update sau lấy tiếp từ hàng đợi
					this.#dirty = true
				})
		}
	}
}
