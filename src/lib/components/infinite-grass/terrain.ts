// Bản CPU của shaders/noise.glsl (noise) + shaders/terrain.glsl (terrainHeight).
// Hash điểm lưới là hash số nguyên nên ra đúng giá trị như GPU; phần nội suy dùng float64
// thay vì float32, lệch cỡ 1e-6 m. Dùng để đặt vật thể (nhân vật) lên mặt đất.

// pcg3d, khớp latticeGradient() trong noise.glsl: mọi phép tính mod 2^32
function latticeGradient(cx: number, cy: number, cz: number): [number, number, number] {
	let x = (Math.imul(cx >>> 0, 1664525) + 1013904223) >>> 0
	let y = (Math.imul(cy >>> 0, 1664525) + 1013904223) >>> 0
	let z = (Math.imul(cz >>> 0, 1664525) + 1013904223) >>> 0
	x = (x + Math.imul(y, z)) >>> 0
	y = (y + Math.imul(z, x)) >>> 0
	z = (z + Math.imul(x, y)) >>> 0
	x = (x ^ (x >>> 16)) >>> 0
	y = (y ^ (y >>> 16)) >>> 0
	z = (z ^ (z >>> 16)) >>> 0
	x = (x + Math.imul(y, z)) >>> 0
	y = (y + Math.imul(z, x)) >>> 0
	z = (z + Math.imul(x, y)) >>> 0
	const k = 2 / 4294967295
	return [x * k - 1, y * k - 1, z * k - 1]
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t

// Gradient noise 3D, ~[-1, 1], bằng 0 tại điểm lưới nguyên
export function noise3(px: number, py: number, pz: number) {
	const ix = Math.floor(px)
	const iy = Math.floor(py)
	const iz = Math.floor(pz)
	const fx = px - ix
	const fy = py - iy
	const fz = pz - iz
	const ux = fx * fx * (3 - 2 * fx)
	const uy = fy * fy * (3 - 2 * fy)
	const uz = fz * fz * (3 - 2 * fz)

	const corner = (ox: number, oy: number, oz: number) => {
		const [gx, gy, gz] = latticeGradient(ix + ox, iy + oy, iz + oz)
		return gx * (fx - ox) + gy * (fy - oy) + gz * (fz - oz)
	}

	return mix(
		mix(mix(corner(0, 0, 0), corner(1, 0, 0), ux), mix(corner(0, 1, 0), corner(1, 1, 0), ux), uy),
		mix(mix(corner(0, 0, 1), corner(1, 0, 1), ux), mix(corner(0, 1, 1), corner(1, 1, 1), ux), uy),
		uz
	)
}

// Độ cao mặt đất (m) tại (x, z), giống terrainHeight() với y = 0
export function terrainHeight(x: number, z: number, frequency: number, amplitude: number) {
	return noise3(x * frequency, 0, z * frequency) * amplitude
}
