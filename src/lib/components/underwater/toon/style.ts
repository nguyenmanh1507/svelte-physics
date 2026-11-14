// Rendering style: the simulation (waves, waterline, caustics, underwater medium) is shared, only shading changes.

export type Style = 'realistic' | 'toon'

export function styleFromUrl(search: string): Style {
	return new URLSearchParams(search).get('style') === 'toon' ? 'toon' : 'realistic'
}

export function otherStyle(style: Style): Style {
	return style === 'toon' ? 'realistic' : 'toon'
}

/** image parameters that differ per style (keys of the water params object) */
export const STYLE_PARAMS = {
	// film grain and a strong vignette fight flat colour areas; AgX desaturates, flat colours want the opposite
	toon: { grain: 0, vignette: 0.12, bloom: 0.02, saturation: 1.5 },
} as const

type StyleKey = keyof (typeof STYLE_PARAMS)['toon']
const STYLE_KEYS = Object.keys(STYLE_PARAMS.toon) as StyleKey[]
export type SavedStyleParams = Partial<Record<Style, Record<StyleKey, number>>>

/**
 * Switch the style-dependent params from one style to another. The values in use are remembered per style in
 * `saved`, so tuning done in the debug panel survives switching back and forth.
 */
export function applyStyleParams(
	params: Record<StyleKey, number>,
	from: Style,
	to: Style,
	saved: SavedStyleParams
): void {
	if (from === to) return
	const current = {} as Record<StyleKey, number>
	for (const key of STYLE_KEYS) current[key] = params[key]
	saved[from] = current
	const next = saved[to] ?? (to === 'toon' ? STYLE_PARAMS.toon : null)
	if (next) for (const key of STYLE_KEYS) params[key] = next[key]
}
