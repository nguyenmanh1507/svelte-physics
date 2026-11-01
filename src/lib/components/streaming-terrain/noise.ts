// Noise và số ngẫu nhiên có seed, chỉ dùng phép toán số nguyên 32-bit nên ra cùng kết quả
// trên mọi máy: cùng một ô luôn sinh cùng địa hình, cùng cây ở cùng chỗ.

export const WORLD_SEED = 1

// Hash 2 số nguyên (+ seed) -> uint32, trộn kiểu murmur3 finalizer
export function hash2(x: number, y: number, seed = WORLD_SEED) {
	let h =
		(Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed, 0x9e3779b1)) >>>
		0
	h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
	h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
	return (h ^ (h >>> 16)) >>> 0
}

// mulberry32: PRNG nhỏ, đủ đều để rải vật thể. Trả về hàm cho số trong [0, 1)
export function createRandom(seed: number) {
	let a = seed >>> 0
	return () => {
		a = (a + 0x6d2b79f5) >>> 0
		let t = a
		t = Math.imul(t ^ (t >>> 15), t | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

const TAU = Math.PI * 2

function gradientDot(ix: number, iy: number, dx: number, dy: number, seed: number) {
	const angle = (hash2(ix, iy, seed) / 4294967296) * TAU
	return Math.cos(angle) * dx + Math.sin(angle) * dy
}

// Gradient noise 2D, ~[-1, 1], bằng 0 tại các điểm lưới nguyên
export function noise2(x: number, y: number, seed = WORLD_SEED) {
	const ix = Math.floor(x)
	const iy = Math.floor(y)
	const fx = x - ix
	const fy = y - iy
	// quintic fade: đạo hàm bậc 2 liên tục -> pháp tuyến không gãy giữa các ô lưới
	const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10)
	const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10)

	const a = gradientDot(ix, iy, fx, fy, seed)
	const b = gradientDot(ix + 1, iy, fx - 1, fy, seed)
	const c = gradientDot(ix, iy + 1, fx, fy - 1, seed)
	const d = gradientDot(ix + 1, iy + 1, fx - 1, fy - 1, seed)
	const top = a + (b - a) * ux
	const bottom = c + (d - c) * ux
	// gradient đơn vị cho biên độ tối đa √½, nhân √2 để về ~[-1, 1]
	return (top + (bottom - top) * uy) * Math.SQRT2
}
