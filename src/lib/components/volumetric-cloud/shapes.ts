// Hình dáng mây: mỗi đám mây là một hộp chứa vài khối cầu (blob) dính vào nhau.
// Shader lấy hợp mềm của các khối cầu, cắt phẳng đáy, rồi dùng noise ăn mòn mép,
// nên chỉ cần đổi cách xếp blob là ra các kiểu mây khác nhau.

export type CloudKind = 'cumulus' | 'towering' | 'stratus' | 'cluster'

export const CLOUD_KINDS: CloudKind[] = ['cumulus', 'towering', 'stratus', 'cluster']

export const MAX_BLOBS = 8

export type Vec3 = [number, number, number]

// center: toạ độ trong hộp, mỗi trục -1..1. radius: bán kính theo world unit.
export type Blob = { center: Vec3; radius: number }

export type CloudShape = {
	kind: CloudKind
	size: Vec3 // kích thước hộp, world unit
	blobs: Blob[]
	squash: Vec3 // ép blob theo trục: > 1 làm blob dẹt theo trục đó
	base: number // độ cao chân mây trong hộp (-1..1): dưới mức này mây bị cắt phẳng
	erosion: number // noise ăn mòn mép mạnh tới đâu (0..1)
	stretch: Vec3 // co giãn noise theo từng trục: < 1 kéo dài vệt mây theo trục đó
	density: number // hệ số tán xạ trên mỗi world unit ở chỗ đặc nhất
	seed: Vec3 // lệch noise để hai đám mây cùng kiểu không giống hệt nhau
}

export type Random = () => number

// mulberry32: đủ tốt cho bố cục, và cùng seed luôn cho cùng kết quả
export function createRandom(seed: number): Random {
	let a = seed >>> 0
	return () => {
		a = (a + 0x6d2b79f5) >>> 0
		let t = a
		t = Math.imul(t ^ (t >>> 15), t | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

const between = (rng: Random, min: number, max: number) => min + rng() * (max - min)

// Chuyển bán kính tính theo world sang toạ độ hộp, để giữ blob nằm trong hộp.
const fit = (value: number, radius: number, half: number) => {
	const limit = Math.max(0, 1 - radius / half)
	return Math.max(-limit, Math.min(limit, value))
}

function blob(size: Vec3, center: Vec3, radius: number): Blob {
	const half = size.map((s) => s / 2)
	// riêng trục y cho phép blob lấn ra ngoài: đỉnh và đáy đã được shader làm mờ
	return {
		center: [fit(center[0], radius, half[0]), center[1], fit(center[2], radius, half[2])],
		radius,
	}
}

// Mây tích: chân phẳng, thân phồng, đỉnh gồ lên vài cục như súp lơ.
function cumulus(rng: Random): Omit<CloudShape, 'seed'> {
	const size: Vec3 = [between(rng, 60, 80), between(rng, 30, 38), between(rng, 42, 55)]
	const blobs: Blob[] = []
	const baseCount = 3 + Math.floor(rng() * 2)
	for (let i = 0; i < baseCount; i++) {
		const x = -0.55 + (1.1 * i) / (baseCount - 1)
		blobs.push(blob(size, [x, -0.25, between(rng, -0.15, 0.15)], between(rng, 13, 16)))
	}
	blobs.push(
		blob(size, [between(rng, -0.35, -0.1), 0.2, between(rng, -0.1, 0.1)], between(rng, 12, 14))
	)
	blobs.push(
		blob(size, [between(rng, 0.1, 0.35), 0.25, between(rng, -0.1, 0.1)], between(rng, 11, 13))
	)
	blobs.push(blob(size, [between(rng, -0.15, 0.15), 0.5, 0], between(rng, 9, 11)))
	return {
		kind: 'cumulus',
		size,
		blobs,
		squash: [1, 1.1, 1],
		base: -0.55,
		erosion: 0.85,
		stretch: [1, 1, 1],
		density: 0.3,
	}
}

// Mây tháp: thân cao xếp từ nhiều khối chồng sát nhau (không lộ từng tầng),
// chân loe rộng, đỉnh nhỏ dần và hơi nghiêng, thêm một cục phồng ở sườn.
function towering(rng: Random): Omit<CloudShape, 'seed'> {
	const size: Vec3 = [between(rng, 46, 56), between(rng, 75, 90), between(rng, 46, 56)]
	const lean = between(rng, -0.25, 0.25)
	const blobs: Blob[] = [
		blob(size, [-0.4, -0.5, between(rng, -0.2, 0.2)], 15),
		blob(size, [0.4, -0.5, between(rng, -0.2, 0.2)], 15),
	]
	const levels = 5
	for (let i = 0; i < levels; i++) {
		const k = i / (levels - 1)
		const jitter = () => between(rng, -0.12, 0.12)
		blobs.push(blob(size, [lean * k + jitter(), -0.5 + 1.05 * k, jitter()], 19 - 8 * k))
	}
	const side = rng() < 0.5 ? -1 : 1
	blobs.push(blob(size, [side * 0.35, between(rng, -0.1, 0.15), between(rng, -0.2, 0.2)], 12))
	return {
		kind: 'towering',
		size,
		blobs,
		squash: [1, 1, 1],
		base: -0.75,
		erosion: 0.85,
		stretch: [1, 1, 1],
		density: 0.3,
	}
}

// Mây tầng: một lớp mỏng trải rộng, noise kéo dài theo chiều gió thành vệt.
function stratus(rng: Random): Omit<CloudShape, 'seed'> {
	const size: Vec3 = [between(rng, 140, 170), between(rng, 12, 16), between(rng, 80, 100)]
	const blobs: Blob[] = []
	const count = 6 + Math.floor(rng() * 3)
	for (let i = 0; i < count; i++) {
		blobs.push(
			blob(size, [between(rng, -0.6, 0.6), 0, between(rng, -0.5, 0.5)], between(rng, 26, 36))
		)
	}
	return {
		kind: 'stratus',
		size,
		blobs,
		squash: [1, 1, 1],
		base: -0.7,
		erosion: 1,
		stretch: [0.35, 1, 1],
		density: 0.22,
	}
}

// Cụm mây vụn: vài nhóm cục dẹt nằm gần nhau, giữa các nhóm là khoảng trống.
function cluster(rng: Random): Omit<CloudShape, 'seed'> {
	const size: Vec3 = [between(rng, 90, 110), between(rng, 22, 28), between(rng, 68, 80)]
	const blobs: Blob[] = []
	const groups = 3
	for (let g = 0; g < groups && blobs.length < MAX_BLOBS; g++) {
		const gx = -0.55 + (1.1 * g) / (groups - 1) + between(rng, -0.1, 0.1)
		const gz = between(rng, -0.45, 0.45)
		const count = Math.min(2 + Math.floor(rng() * 2), MAX_BLOBS - blobs.length)
		for (let i = 0; i < count; i++) {
			const center: Vec3 = [
				gx + between(rng, -0.15, 0.15),
				between(rng, -0.1, 0.15),
				gz + between(rng, -0.2, 0.2),
			]
			blobs.push(blob(size, center, between(rng, 10, 14)))
		}
	}
	return {
		kind: 'cluster',
		size,
		blobs,
		squash: [1, 1.6, 1],
		base: -0.5,
		erosion: 0.95,
		stretch: [1, 1, 1],
		density: 0.28,
	}
}

const BUILDERS: Record<CloudKind, (rng: Random) => Omit<CloudShape, 'seed'>> = {
	cumulus,
	towering,
	stratus,
	cluster,
}

export function createCloudShape(kind: CloudKind, rng: Random): CloudShape {
	const shape = BUILDERS[kind](rng)
	return { ...shape, seed: [rng() * 100, rng() * 100, rng() * 100] }
}

// Rải count điểm trong hình vuông [-span, span]: mỗi điểm một ô của lưới k x k,
// lệch ngẫu nhiên trong ô. Đều hơn rải ngẫu nhiên thuần mà vẫn không thẳng hàng.
export function scatter(count: number, span: number, rng: Random): [x: number, z: number][] {
	const k = Math.ceil(Math.sqrt(count))
	const cell = (2 * span) / k
	const cells = Array.from({ length: k * k }, (_, i) => i)
	for (let i = cells.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1))
		;[cells[i], cells[j]] = [cells[j], cells[i]]
	}
	return cells.slice(0, count).map((c) => {
		const jitter = () => (rng() - 0.5) * cell * 0.6
		return [
			-span + ((c % k) + 0.5) * cell + jitter(),
			-span + (Math.floor(c / k) + 0.5) * cell + jitter(),
		]
	})
}
