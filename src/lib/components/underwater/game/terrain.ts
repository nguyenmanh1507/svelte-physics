// Seabed height field (pure CPU, shared by the mesh, the submarine and the camera).
// 1 unit = 1 m, still water level at y = 0.

/** half size of the play area: the submarine stays within x, z in [-PLAY_HALF, PLAY_HALF] */
export const PLAY_HALF = 50

const MEAN_DEPTH = 2
const MAX_RELIEF = 0.6

function hash(x: number, y: number): number {
	const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
	return s - Math.floor(s)
}

function vnoise(x: number, y: number): number {
	const xi = Math.floor(x)
	const yi = Math.floor(y)
	const xf = x - xi
	const yf = y - yi
	const u = xf * xf * (3 - 2 * xf)
	const v = yf * yf * (3 - 2 * yf)
	const a = hash(xi, yi)
	const b = hash(xi + 1, yi)
	const c = hash(xi, yi + 1)
	const d = hash(xi + 1, yi + 1)
	return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1
}

function fbm(x: number, y: number): number {
	let sum = 0
	let amp = 0.5
	let freq = 1
	for (let i = 0; i < 4; i++) {
		sum += amp * vnoise(x * freq, y * freq)
		amp *= 0.5
		freq *= 2.03
	}
	return sum
}

/** seabed elevation (negative) at world (x, z): about 2 m deep with gentle dunes, always 1.4 to 2.6 m */
export function terrainHeight(x: number, z: number): number {
	const dunes = fbm(x * 0.045, z * 0.045) * 0.9
	const ripples = fbm(x * 0.18 + 7, z * 0.18 - 3) * 0.18
	const relief = Math.min(MAX_RELIEF, Math.max(-MAX_RELIEF, dunes + ripples))
	return -MEAN_DEPTH + relief
}
