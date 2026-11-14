// Frame-rate meter: counts frames over a fixed window instead of smoothing per-frame times.

export interface FpsReading {
	fps: number
	/** mean time between frames over the window, ms */
	frameMs: number
}

/** a gap longer than this (hidden tab, debugger pause) restarts the window instead of counting as a frame */
const MAX_GAP_MS = 1000

export function createFpsMeter(windowMs = 500) {
	let start = -1
	let last = -1
	let frames = 0
	return {
		/** call once per frame; returns a reading each time a window completes */
		tick(nowMs: number): FpsReading | null {
			if (start < 0 || nowMs - last > MAX_GAP_MS) {
				start = last = nowMs
				frames = 0
				return null
			}
			last = nowMs
			frames++
			const elapsed = nowMs - start
			if (elapsed < windowMs) return null
			const reading = { fps: (frames * 1000) / elapsed, frameMs: elapsed / frames }
			start = nowMs
			frames = 0
			return reading
		},
	}
}
