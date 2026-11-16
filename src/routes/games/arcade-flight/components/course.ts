// Dữ liệu sân bay tập (thuần, không phụ thuộc Three.js): vòng bay, đồi hình nón, cụm mây.
// Mọi toạ độ theo hệ Three.js (Y lên, mặt đất y = 0).

export type Point = { x: number; y: number; z: number }
export type Ring = { position: Point; tangent: Point }
/** đồi hình nón: tâm (x, z), bán kính đáy r, cao h, góc xoay quanh Y (chỉ để nhìn) */
export type Hill = { x: number; z: number; r: number; h: number; rot: number }
export type CloudPuff = { position: Point; scale: number }

export const RING_COUNT = 12
export const RING_RADIUS = 3500
/** bay cách tâm vòng dưới khoảng này thì tính là đã qua */
export const RING_HIT_RADIUS = 75
/** độ cao tối thiểu so với mặt đất phẳng trước khi tính là va chạm */
export const GROUND_CLEARANCE = 1.5

/** LCG Park–Miller: cùng seed → cùng địa hình */
export function seededRandom(seed: number) {
	let s = seed
	return () => (s = (s * 16807) % 2147483647) / 2147483647
}

export function createCourse(seed = 7) {
	const rnd = seededRandom(seed)

	// vòng tròn bán kính RING_RADIUS, độ cao lượn sóng 850–1750 m
	const rings: Ring[] = []
	for (let i = 0; i < RING_COUNT; i++) {
		const th = (i / RING_COUNT) * Math.PI * 2
		rings.push({
			position: {
				x: RING_RADIUS * Math.cos(th),
				y: 1300 + 450 * Math.sin(2 * th),
				z: -RING_RADIUS * Math.sin(th),
			},
			tangent: { x: -Math.sin(th), y: 0, z: -Math.cos(th) },
		})
	}

	// đồi tránh xa đường vòng để không chắn lối bay
	const hills: Hill[] = []
	for (let guard = 0; hills.length < 70 && guard < 2000; guard++) {
		const x = (rnd() - 0.5) * 26000
		const z = (rnd() - 0.5) * 26000
		const r = 400 + rnd() * 1300
		const h = 250 + rnd() * 1100
		if (Math.abs(Math.hypot(x, z) - RING_RADIUS) < r + 700) continue
		// prototype sinh theo hệ lõi (Z trước) → lật Z sang hệ Three.js
		hills.push({ x, z: -z, r, h, rot: rnd() * 6 })
	}

	const clouds: CloudPuff[] = []
	for (let c = 0; c < 60; c++) {
		const cx = (rnd() - 0.5) * 30000
		const cz = (rnd() - 0.5) * 30000
		const cy = 2300 + rnd() * 1500
		for (let j = 0; j < 6; j++) {
			const position = {
				x: cx + (rnd() - 0.5) * 900,
				y: cy + (rnd() - 0.5) * 120,
				z: cz + (rnd() - 0.5) * 900,
			}
			clouds.push({ position, scale: 180 + rnd() * 260 })
		}
	}

	// xuất phát trên đường vòng, hướng theo tiếp tuyến
	const th = -25 * (Math.PI / 180)
	const spawn = {
		position: { x: RING_RADIUS * Math.cos(th), y: 1500, z: -RING_RADIUS * Math.sin(th) },
		headingDeg: 25,
	}

	return { rings, hills, clouds, spawn }
}

export type Course = ReturnType<typeof createCourse>

/** độ cao mặt đất (đồi hình nón trên nền phẳng y = 0) */
export function groundHeightAt(hills: Hill[], x: number, z: number) {
	let g = 0
	for (const h of hills) {
		const d = Math.hypot(x - h.x, z - h.z)
		if (d < h.r) g = Math.max(g, h.h * (1 - d / h.r))
	}
	return g
}

export function collidesWithTerrain(hills: Hill[], p: Point) {
	if (p.y < GROUND_CLEARANCE) return true
	return p.y < groundHeightAt(hills, p.x, p.z)
}

/** đánh dấu các vòng vừa bay qua; trả về chỉ số vòng mới qua */
export function passRings(rings: Ring[], passed: boolean[], p: Point) {
	const hits: number[] = []
	rings.forEach((r, i) => {
		if (passed[i]) return
		const d = Math.hypot(p.x - r.position.x, p.y - r.position.y, p.z - r.position.z)
		if (d < RING_HIT_RADIUS) {
			passed[i] = true
			hits.push(i)
		}
	})
	return hits
}
