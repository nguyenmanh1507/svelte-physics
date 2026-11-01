export interface Disposable {
	dispose(): void
}

type Entry<T> = {
	promise: Promise<T>
	refs: number
}

export type AssetCacheStats = { loaded: number; loading: number; idle: number }

// Cache asset có đếm tham chiếu:
//  - mỗi key chỉ nạp một lần, dù nhiều nơi xin cùng lúc (dùng chung một promise)
//  - nạp lỗi thì bỏ entry đi, lần xin sau thử nạp lại
//  - hết người dùng (refs = 0) thì asset vào danh sách nhàn rỗi; quá `maxIdle` thì huỷ asset cũ nhất
//  - dispose() huỷ mọi asset, kể cả asset đang nạp dở (huỷ ngay khi nạp xong)
export class AssetCache<T extends Disposable> {
	#load: (key: string) => Promise<T>
	#maxIdle: number
	#entries = new Map<string, Entry<T>>()
	#loaded = new Set<string>()
	#idle = new Set<string>() // thứ tự chèn = thứ tự rảnh, phần tử đầu là cũ nhất
	#disposed = false

	constructor(load: (key: string) => Promise<T>, { maxIdle = 32 } = {}) {
		this.#load = load
		this.#maxIdle = maxIdle
	}

	get stats(): AssetCacheStats {
		return {
			loaded: this.#loaded.size,
			loading: this.#entries.size - this.#loaded.size,
			idle: this.#idle.size,
		}
	}

	// Lấy asset và giữ một tham chiếu; mỗi lần acquire thành công phải đi kèm đúng một release
	async acquire(key: string): Promise<T> {
		if (this.#disposed) throw new Error('AssetCache đã bị huỷ')

		let entry = this.#entries.get(key)
		if (!entry) {
			const promise = this.#load(key)
			const created: Entry<T> = { promise, refs: 0 }
			entry = created
			this.#entries.set(key, created)
			promise.then(
				() => {
					if (this.#entries.get(key) === created) this.#loaded.add(key)
				},
				() => {
					if (this.#entries.get(key) === created) this.#entries.delete(key)
				}
			)
		}
		entry.refs++
		this.#idle.delete(key)

		try {
			return await entry.promise
		} catch (e) {
			entry.refs--
			throw e
		}
	}

	release(key: string) {
		const entry = this.#entries.get(key)
		if (!entry || entry.refs <= 0) return
		entry.refs--
		if (entry.refs > 0) return

		this.#idle.add(key)
		while (this.#idle.size > this.#maxIdle) {
			const [oldest] = this.#idle
			this.#evict(oldest)
		}
	}

	dispose() {
		this.#disposed = true
		for (const key of [...this.#entries.keys()]) this.#evict(key)
	}

	#evict(key: string) {
		const entry = this.#entries.get(key)
		this.#entries.delete(key)
		this.#loaded.delete(key)
		this.#idle.delete(key)
		entry?.promise.then(
			(asset) => asset.dispose(),
			() => {}
		)
	}
}
