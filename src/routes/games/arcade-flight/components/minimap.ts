// Mini map nhìn từ trên xuống: vệt bay, vòng bay, đồi và máy bay. Logic thuần + vẽ canvas 2D.
// Hệ toạ độ Three.js: mặt đất là mặt XZ; trên bản đồ −Z hướng lên trên, +X sang phải.
import type { Hill, Point, Ring } from './course'

type XZ = { x: number; z: number }

/** Vệt bay: chỉ ghi điểm khi đã đi xa điểm trước ≥ `minStep` m, giữ tối đa `maxPoints` điểm */
export class FlightTrail {
	readonly points: Point[] = []

	constructor(
		readonly minStep = 25,
		readonly maxPoints = 3000
	) {}

	push(p: Point) {
		const last = this.points.at(-1)
		if (last && Math.hypot(p.x - last.x, p.y - last.y, p.z - last.z) < this.minStep) return false
		this.points.push({ x: p.x, y: p.y, z: p.z })
		const overflow = this.points.length - this.maxPoints
		if (overflow > 0) this.points.splice(0, overflow)
		return true
	}

	clear() {
		this.points.length = 0
	}
}

/** Khung nhìn vuông: tâm (cx, cz) và nửa cạnh `half` (m) */
export type MapView = { cx: number; cz: number; half: number }

/** Khung vuông nhỏ nhất chứa mọi điểm (cộng lề `margin`), không nhỏ hơn `minHalf` */
export function fitView(groups: Iterable<XZ>[], minHalf: number, margin = 1.12): MapView {
	let x0 = Infinity
	let x1 = -Infinity
	let z0 = Infinity
	let z1 = -Infinity
	for (const g of groups)
		for (const p of g) {
			x0 = Math.min(x0, p.x)
			x1 = Math.max(x1, p.x)
			z0 = Math.min(z0, p.z)
			z1 = Math.max(z1, p.z)
		}
	if (x0 > x1) return { cx: 0, cz: 0, half: minHalf }
	return {
		cx: (x0 + x1) / 2,
		cz: (z0 + z1) / 2,
		half: Math.max(minHalf, (Math.max(x1 - x0, z1 - z0) / 2) * margin),
	}
}

/** Trượt khung nhìn về đích (k ∈ [0, 1]) để bản đồ không giật khi vệt bay nới rộng */
export function easeView(cur: MapView, target: MapView, k: number): MapView {
	return {
		cx: cur.cx + (target.cx - cur.cx) * k,
		cz: cur.cz + (target.cz - cur.cz) * k,
		half: cur.half + (target.half - cur.half) * k,
	}
}

/** Toạ độ thế giới → pixel trên canvas cạnh `size` */
export function projector(view: MapView, size: number) {
	const s = size / 2 / view.half
	return (x: number, z: number): [number, number] => [
		size / 2 + (x - view.cx) * s,
		size / 2 + (z - view.cz) * s,
	]
}

/** Độ dài thước tỉ lệ "tròn" (1/2/5 × 10^n m) gần nhất không vượt `maxMetres` */
export function niceLength(maxMetres: number) {
	const p = 10 ** Math.floor(Math.log10(maxMetres))
	for (const m of [5, 2, 1]) if (m * p <= maxMetres) return m * p
	return p
}

/** độ cao thể hiện bằng màu vệt bay: cam (thấp) → xanh lơ (cao) */
export const TRAIL_ALT_MAX = 3000
const altColor = (y: number) =>
	`hsl(${25 + Math.min(Math.max(y / TRAIL_ALT_MAX, 0), 1) * 165} 95% 60%)`

export type MinimapData = {
	position: Point
	/** hướng mũi chiếu lên mặt đất (x, z), không cần chuẩn hoá */
	forward: XZ
	trail: readonly Point[]
	rings: readonly Ring[]
	passed: readonly boolean[]
	hills: readonly Hill[]
}

const fmtLength = (m: number) => (m >= 1000 ? `${m / 1000} km` : `${m} m`)

/** Vẽ một khung; `size` là cạnh canvas theo CSS px (ctx đã scale theo devicePixelRatio) */
export function drawMinimap(
	ctx: CanvasRenderingContext2D,
	size: number,
	view: MapView,
	d: MinimapData
) {
	const map = projector(view, size)
	const s = size / 2 / view.half
	ctx.clearRect(0, 0, size, size)
	ctx.fillStyle = 'rgb(18 38 30 / 0.78)'
	ctx.fillRect(0, 0, size, size)

	// đồi: càng cao càng sáng
	for (const h of d.hills) {
		const [x, y] = map(h.x, h.z)
		const r = h.r * s
		if (x + r < 0 || x - r > size || y + r < 0 || y - r > size) continue
		ctx.beginPath()
		ctx.arc(x, y, r, 0, Math.PI * 2)
		ctx.fillStyle = `rgb(150 170 140 / ${0.12 + (h.h / 1400) * 0.3})`
		ctx.fill()
	}

	// vệt bay: đoạn cũ mờ dần, màu theo độ cao
	const n = d.trail.length
	ctx.lineWidth = 1.6
	ctx.lineCap = 'round'
	for (let i = 1; i < n; i++) {
		const a = d.trail[i - 1]
		const b = d.trail[i]
		const [x0, y0] = map(a.x, a.z)
		const [x1, y1] = map(b.x, b.z)
		ctx.globalAlpha = 0.25 + 0.75 * (i / n)
		ctx.strokeStyle = altColor(b.y)
		ctx.beginPath()
		ctx.moveTo(x0, y0)
		ctx.lineTo(x1, y1)
		ctx.stroke()
	}
	ctx.globalAlpha = 1

	// vòng bay: chưa qua = vòng xanh, đã qua = chấm mờ
	d.rings.forEach((ring, i) => {
		const [x, y] = map(ring.position.x, ring.position.z)
		ctx.beginPath()
		ctx.arc(x, y, 3.5, 0, Math.PI * 2)
		if (d.passed[i]) {
			ctx.fillStyle = 'rgb(255 255 255 / 0.35)'
			ctx.fill()
		} else {
			ctx.strokeStyle = '#7dffb0'
			ctx.lineWidth = 1.5
			ctx.stroke()
		}
	})

	// máy bay: tam giác chỉ hướng mũi
	const [px, py] = map(d.position.x, d.position.z)
	const ang = Math.atan2(d.forward.z, d.forward.x)
	ctx.save()
	ctx.translate(Math.min(Math.max(px, 6), size - 6), Math.min(Math.max(py, 6), size - 6))
	ctx.rotate(ang)
	ctx.beginPath()
	ctx.moveTo(7, 0)
	ctx.lineTo(-5, 4.5)
	ctx.lineTo(-2.5, 0)
	ctx.lineTo(-5, -4.5)
	ctx.closePath()
	ctx.fillStyle = '#fff'
	ctx.strokeStyle = 'rgb(0 0 0 / 0.6)'
	ctx.lineWidth = 1
	ctx.fill()
	ctx.stroke()
	ctx.restore()

	// thước tỉ lệ + chú giải màu độ cao
	const len = niceLength(view.half * 0.6)
	const barPx = len * s
	const by = size - 10
	ctx.strokeStyle = '#e8f3ee'
	ctx.lineWidth = 1.5
	ctx.beginPath()
	ctx.moveTo(8, by - 3)
	ctx.lineTo(8, by)
	ctx.lineTo(8 + barPx, by)
	ctx.lineTo(8 + barPx, by - 3)
	ctx.stroke()
	ctx.font = '10px ui-monospace, monospace'
	ctx.fillStyle = '#e8f3ee'
	ctx.textBaseline = 'bottom'
	ctx.textAlign = 'left'
	ctx.fillText(fmtLength(len), 8, by - 4)

	const gw = 44
	const gx = size - gw - 8
	const grad = ctx.createLinearGradient(gx, 0, gx + gw, 0)
	for (const t of [0, 0.5, 1]) grad.addColorStop(t, altColor(t * TRAIL_ALT_MAX))
	ctx.fillStyle = grad
	ctx.fillRect(gx, by - 3, gw, 3)
	ctx.fillStyle = '#e8f3ee'
	ctx.textAlign = 'right'
	ctx.fillText(`ALT 0–${TRAIL_ALT_MAX / 1000} km`, size - 8, by - 4)
}
