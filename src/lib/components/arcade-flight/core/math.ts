// Toán vector/quaternion tối giản cho lõi bay — không phụ thuộc Three.js.
// Hệ toạ độ lõi: X = phải, Y = lên, Z = trước (trái tay, giống Unity).

export type Vec3 = { x: number; y: number; z: number }
export type Quat = { x: number; y: number; z: number; w: number }
/** Curve tuyến tính từng đoạn: [[x, y], …] với x tăng dần. */
export type Curve = [number, number][]

export const v3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z })
export const add = (a: Vec3, b: Vec3) => v3(a.x + b.x, a.y + b.y, a.z + b.z)
export const sub = (a: Vec3, b: Vec3) => v3(a.x - b.x, a.y - b.y, a.z - b.z)
export const mul = (a: Vec3, s: number) => v3(a.x * s, a.y * s, a.z * s)
export const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z
export const cross = (a: Vec3, b: Vec3) =>
	v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x)
export const len = (a: Vec3) => Math.hypot(a.x, a.y, a.z)
export const norm = (a: Vec3) => {
	const l = len(a)
	return l > 1e-9 ? mul(a, 1 / l) : v3()
}
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
export const clamp01 = (x: number) => clamp(x, 0, 1)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export const qMul = (a: Quat, b: Quat): Quat => ({
	w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
	x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
	y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
	z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
})
export const qConj = (q: Quat): Quat => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w })
export const qNorm = (q: Quat): Quat => {
	const l = Math.hypot(q.x, q.y, q.z, q.w)
	return { x: q.x / l, y: q.y / l, z: q.z / l, w: q.w / l }
}
export const qAxisAngle = (axis: Vec3, ang: number): Quat => {
	const s = Math.sin(ang / 2)
	return { x: axis.x * s, y: axis.y * s, z: axis.z * s, w: Math.cos(ang / 2) }
}
export const qRotate = (q: Quat, p: Vec3) => {
	const r = qMul(qMul(q, { x: p.x, y: p.y, z: p.z, w: 0 }), qConj(q))
	return v3(r.x, r.y, r.z)
}
export const qIdent = (): Quat => ({ x: 0, y: 0, z: 0, w: 1 })

export const FWD = v3(0, 0, 1)
export const RIGHT = v3(1, 0, 0)
export const UP = v3(0, 1, 0)
export const G = 9.81
export const D2R = Math.PI / 180
export const R2D = 180 / Math.PI

/** smoothstep trên [0, 1] */
export const ease = (u: number) => {
	u = clamp01(u)
	return u * u * (3 - 2 * u)
}

/** Quaternion chỉ có yaw (heading) từ một vector forward */
export function qYawFrom(fwd: Vec3) {
	return qAxisAngle(UP, Math.atan2(fwd.x, fwd.z))
}

/** Sai số hướng (body frame) → vector trục·góc */
export function attitudeError(cur: Quat, target: Quat) {
	let e = qMul(qConj(cur), target)
	if (e.w < 0) e = { x: -e.x, y: -e.y, z: -e.z, w: -e.w }
	const s = Math.sqrt(Math.max(1e-12, 1 - e.w * e.w))
	const ang = 2 * Math.acos(clamp(e.w, -1, 1))
	return s < 1e-6 ? v3() : v3((e.x / s) * ang, (e.y / s) * ang, (e.z / s) * ang)
}

export function evalCurve(c: Curve, x: number) {
	if (x <= c[0][0]) return c[0][1]
	for (let i = 1; i < c.length; i++)
		if (x <= c[i][0]) {
			const [x0, y0] = c[i - 1]
			const [x1, y1] = c[i]
			return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
		}
	return c[c.length - 1][1]
}
