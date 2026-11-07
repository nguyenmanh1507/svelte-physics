// Di chuyển người xem trên mặt phẳng XZ: thân là hình tròn, vật cản là hình chữ nhật thẳng trục.

export interface Rect {
	minX: number
	maxX: number
	minZ: number
	maxZ: number
}

export interface Point {
	x: number
	z: number
}

const EPS = 1e-4

// Đi (dx, dz), tách từng trục để trượt dọc tường; chia nhỏ bước để không xuyên vật mỏng.
export function moveCircle(pos: Point, dx: number, dz: number, radius: number, rects: Rect[]) {
	const p = { x: pos.x, z: pos.z }
	const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / (radius * 0.5)))
	const sx = dx / steps
	const sz = dz / steps

	for (let i = 0; i < steps; i++) {
		p.x += sx
		for (const r of rects) {
			if (!overlaps(p, r, radius)) continue
			p.x = sx > 0 ? r.minX - radius - EPS : r.maxX + radius + EPS
		}
		p.z += sz
		for (const r of rects) {
			if (!overlaps(p, r, radius)) continue
			p.z = sz > 0 ? r.minZ - radius - EPS : r.maxZ + radius + EPS
		}
	}
	return p
}

function overlaps(p: Point, r: Rect, radius: number) {
	return (
		p.x > r.minX - radius && p.x < r.maxX + radius && p.z > r.minZ - radius && p.z < r.maxZ + radius
	)
}

// Hướng đi (đã chuẩn hoá) từ yaw camera và phím: forward/right ∈ {-1, 0, 1}.
// yaw = 0 nhìn về -Z như camera three.js.
export function walkDirection(yaw: number, forward: number, right: number): Point {
	const x = -Math.sin(yaw) * forward + Math.cos(yaw) * right
	const z = -Math.cos(yaw) * forward - Math.sin(yaw) * right
	const len = Math.hypot(x, z)
	if (len < EPS) return { x: 0, z: 0 }
	return { x: x / len, z: z / len }
}
