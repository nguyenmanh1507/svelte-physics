// nhiễu xác định (không dùng Math.random) để địa hình giống nhau ở mọi lần nạp và trong unit test

export function hash2(ix: number, iz: number) {
	let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263)
	h = Math.imul(h ^ (h >>> 13), 1274126177)
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

export function valueNoise(x: number, z: number) {
	const ix = Math.floor(x),
		iz = Math.floor(z)
	const fx = x - ix,
		fz = z - iz
	const ux = fx * fx * (3 - 2 * fx),
		uz = fz * fz * (3 - 2 * fz)
	const a = hash2(ix, iz),
		b = hash2(ix + 1, iz),
		c = hash2(ix, iz + 1),
		d = hash2(ix + 1, iz + 1)
	return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz
}

/** fbm chuẩn hoá về [0, 1], trung bình ≈ 0.5 */
export function fbm(x: number, z: number, octaves: number) {
	let sum = 0,
		amp = 0.5,
		norm = 0
	for (let i = 0; i < octaves; i++) {
		sum += amp * valueNoise(x, z)
		norm += amp
		amp *= 0.5
		// xoay + đổi tỉ lệ mỗi octave để không lộ lưới
		const nx = 1.6 * x - 1.2 * z + 19.1
		z = 1.2 * x + 1.6 * z + 7.3
		x = nx
	}
	return sum / norm
}

export function smooth(a: number, b: number, x: number) {
	const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
	return t * t * (3 - 2 * t)
}

export function mulberry32(seed: number) {
	let a = seed >>> 0
	return () => {
		a = (a + 0x6d2b79f5) >>> 0
		let t = a
		t = Math.imul(t ^ (t >>> 15), t | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

export const GLSL_NOISE = /* glsl */ `
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
`
