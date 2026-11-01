import { describe, expect, it, vi } from 'vitest'
import { AssetCache } from './asset-cache'

function deferred<T>() {
	let resolve!: (v: T) => void
	let reject!: (e: unknown) => void
	const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)))
	return { promise, resolve, reject }
}

const asset = (name: string) => ({ name, dispose: vi.fn() })
const flush = () => new Promise((r) => setTimeout(r))

describe('AssetCache', () => {
	it('nhiều nơi xin cùng lúc thì chỉ nạp một lần', async () => {
		const load = vi.fn(async (key: string) => asset(key))
		const cache = new AssetCache(load)
		const [a, b] = await Promise.all([cache.acquire('tree'), cache.acquire('tree')])
		expect(a).toBe(b)
		expect(load).toHaveBeenCalledTimes(1)
		expect(cache.stats).toEqual({ loaded: 1, loading: 0, idle: 0 })
	})

	it('nạp lỗi thì lần sau thử lại', async () => {
		const load = vi
			.fn<(key: string) => Promise<ReturnType<typeof asset>>>()
			.mockRejectedValueOnce(new Error('404'))
			.mockImplementation(async (key) => asset(key))
		const cache = new AssetCache(load)
		await expect(cache.acquire('tree')).rejects.toThrow('404')
		await expect(cache.acquire('tree')).resolves.toMatchObject({ name: 'tree' })
		expect(load).toHaveBeenCalledTimes(2)
	})

	it('chỉ huỷ asset khi không còn ai dùng và vượt quá maxIdle, cũ nhất trước', async () => {
		const cache = new AssetCache(async (key: string) => asset(key), { maxIdle: 1 })
		const a = await cache.acquire('a')
		const b = await cache.acquire('b')
		await cache.acquire('a')

		cache.release('a') // a còn 1 tham chiếu
		cache.release('b') // b rảnh (1 <= maxIdle)
		await flush()
		expect(b.dispose).not.toHaveBeenCalled()

		cache.release('a') // a rảnh -> 2 > maxIdle -> huỷ b (rảnh trước)
		await flush()
		expect(b.dispose).toHaveBeenCalledOnce()
		expect(a.dispose).not.toHaveBeenCalled()
		expect(cache.stats).toEqual({ loaded: 1, loading: 0, idle: 1 })
	})

	it('xin lại asset đang rảnh thì dùng tiếp, không nạp lại', async () => {
		const load = vi.fn(async (key: string) => asset(key))
		const cache = new AssetCache(load, { maxIdle: 4 })
		await cache.acquire('a')
		cache.release('a')
		await cache.acquire('a')
		expect(load).toHaveBeenCalledOnce()
		expect(cache.stats.idle).toBe(0)
	})

	it('dispose() huỷ cả asset đang nạp dở khi nó nạp xong', async () => {
		const pending = deferred<ReturnType<typeof asset>>()
		const cache = new AssetCache(() => pending.promise)
		const acquired = cache.acquire('late')
		cache.dispose()
		const late = asset('late')
		pending.resolve(late)
		await acquired
		await flush()
		expect(late.dispose).toHaveBeenCalledOnce()
		await expect(cache.acquire('x')).rejects.toThrow()
	})
})
