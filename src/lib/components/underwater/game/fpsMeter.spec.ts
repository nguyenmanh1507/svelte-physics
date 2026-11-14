import { describe, it, expect } from 'vitest'
import { createFpsMeter } from './fpsMeter'

const feed = (
	meter: ReturnType<typeof createFpsMeter>,
	start: number,
	stepMs: number,
	n: number
) => {
	let reading = null
	for (let i = 1; i <= n; i++) reading = meter.tick(start + i * stepMs) ?? reading
	return reading
}

describe('createFpsMeter', () => {
	it('reports nothing until a full window has passed', () => {
		const meter = createFpsMeter(500)
		meter.tick(0)
		expect(feed(meter, 0, 16, 30)).toBeNull()
	})
	it('reports frames per second and mean frame time over the window', () => {
		const meter = createFpsMeter(500)
		meter.tick(0)
		const r = feed(meter, 0, 1000 / 60, 31)
		expect(r!.fps).toBeCloseTo(60, 0)
		expect(r!.frameMs).toBeCloseTo(16.7, 1)
	})
	it('starts a fresh window after each reading', () => {
		const meter = createFpsMeter(500)
		meter.tick(0)
		// 25 frames of 20 ms close the first window exactly at 500 ms
		expect(feed(meter, 0, 20, 25)!.fps).toBeCloseTo(50, 6)
		const r = feed(meter, 500, 40, 13)
		expect(r!.fps).toBeCloseTo(25, 6)
		expect(r!.frameMs).toBeCloseTo(40, 6)
	})
	it('does not count the gap of a hidden tab as one slow frame', () => {
		const meter = createFpsMeter(500)
		meter.tick(0)
		expect(meter.tick(60_000)).toBeNull()
		const r = feed(meter, 60_000, 1000 / 60, 31)
		expect(r!.fps).toBeCloseTo(60, 0)
	})
})
