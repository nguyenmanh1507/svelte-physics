import { describe, it, expect } from 'vitest'
import { renderSize, clampDt, MIN_RENDER_SIZE, MAX_DT } from './sizing'

describe('renderSize', () => {
	it('scales the canvas size', () => {
		expect(renderSize(1920, 1080, 1.25)).toEqual({ width: 2400, height: 1350 })
	})
	it('never goes below the minimum the post pyramid needs, even for a collapsed window', () => {
		expect(renderSize(0, 0, 1)).toEqual({ width: MIN_RENDER_SIZE, height: MIN_RENDER_SIZE })
		expect(renderSize(10, 2000, 0.5)).toEqual({ width: MIN_RENDER_SIZE, height: 1000 })
	})
})

describe('clampDt', () => {
	it('passes normal frame times through', () => {
		expect(clampDt(1000, 1016)).toBeCloseTo(0.016, 6)
	})
	it('caps a long pause (hidden tab) and never goes negative', () => {
		expect(clampDt(0, 60_000)).toBe(MAX_DT)
		expect(clampDt(1000, 900)).toBe(0)
	})
})
