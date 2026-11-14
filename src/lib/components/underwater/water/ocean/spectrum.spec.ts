import { describe, it, expect } from 'vitest'
import { buildH0 } from './spectrum.js'
import { params as p } from '../params.js'

const cascades = [
	{ L: 250, kMin: 0, kMax: (2 * Math.PI * 6) / 37 },
	{ L: 37, kMin: (2 * Math.PI * 6) / 37, kMax: 1e9 },
]

// the spectrum takes SI units and radians, converted the same way as Ocean.rebuildSpectrum
const params = {
	windSpeed: p.windSpeed,
	fetch: p.fetch * 1000,
	windDir: (p.windDir * Math.PI) / 180,
	swellHeight: p.swellHeight,
	swellLength: p.swellLength,
	swellDir: (p.swellDir * Math.PI) / 180,
	amplitude: 1,
}

describe('buildH0', () => {
	it('is deterministic for a fixed seed', () => {
		const a = buildH0(64, cascades, params, 1337)
		const b = buildH0(64, cascades, params, 1337)
		expect(a.length).toBe(cascades.length * 64 * 64 * 4)
		expect(Array.from(a)).toEqual(Array.from(b))
	})
	it('produces finite, non-zero amplitudes', () => {
		const a = buildH0(64, cascades, params, 1337)
		expect(a.every(Number.isFinite)).toBe(true)
		expect(a.some((v) => v !== 0)).toBe(true)
	})
})
