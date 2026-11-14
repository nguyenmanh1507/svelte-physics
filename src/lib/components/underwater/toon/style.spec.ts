import { describe, it, expect } from 'vitest'
import { styleFromUrl, otherStyle, applyStyleParams, STYLE_PARAMS } from './style'

describe('styleFromUrl', () => {
	it('reads ?style=toon', () => {
		expect(styleFromUrl('?style=toon')).toBe('toon')
		expect(styleFromUrl('?debug&style=toon&quality=low')).toBe('toon')
	})
	it('falls back to realistic for a missing or unknown value', () => {
		expect(styleFromUrl('')).toBe('realistic')
		expect(styleFromUrl('?style=abc')).toBe('realistic')
		expect(styleFromUrl('?style=')).toBe('realistic')
	})
})

describe('otherStyle', () => {
	it('toggles between the two styles', () => {
		expect(otherStyle('realistic')).toBe('toon')
		expect(otherStyle('toon')).toBe('realistic')
	})
})

describe('applyStyleParams', () => {
	const fresh = () => ({ grain: 0.012, vignette: 0.25, bloom: 0.035, saturation: 1, exposure: 1 })

	it('applies the preset of the new style and leaves other params alone', () => {
		const params = fresh()
		applyStyleParams(params, 'realistic', 'toon', {})
		expect(params).toEqual({ ...fresh(), ...STYLE_PARAMS.toon })
		expect(params.exposure).toBe(1)
	})
	it('restores what the user had tuned in a style when switching back to it', () => {
		const params = fresh()
		const saved = {}
		params.bloom = 0.1 // tuned in the debug panel while realistic
		applyStyleParams(params, 'realistic', 'toon', saved)
		params.vignette = 0.5 // tuned while toon
		applyStyleParams(params, 'toon', 'realistic', saved)
		expect(params.bloom).toBe(0.1)
		expect(params.grain).toBe(0.012)
		applyStyleParams(params, 'realistic', 'toon', saved)
		expect(params.vignette).toBe(0.5)
		expect(params.grain).toBe(STYLE_PARAMS.toon.grain)
	})
	it('does nothing when the style does not change', () => {
		const params = fresh()
		applyStyleParams(params, 'realistic', 'realistic', {})
		expect(params).toEqual(fresh())
	})
})
