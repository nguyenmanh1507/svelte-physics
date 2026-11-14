// Frame sizing and timing helpers.

/** the post stack builds a 7-level blur pyramid, which needs at least 64 px per side */
export const MIN_RENDER_SIZE = 64
/** longest simulated step, seconds: a hidden tab resumes with one short step instead of a jump */
export const MAX_DT = 1 / 20

export function renderSize(canvasWidth: number, canvasHeight: number, scale: number) {
	return {
		width: Math.max(MIN_RENDER_SIZE, Math.round(canvasWidth * scale)),
		height: Math.max(MIN_RENDER_SIZE, Math.round(canvasHeight * scale)),
	}
}

export function clampDt(lastMs: number, nowMs: number): number {
	return Math.min(MAX_DT, Math.max(0, (nowMs - lastMs) / 1000))
}
