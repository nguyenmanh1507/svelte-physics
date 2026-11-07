import type { Rect } from './walk'

// Khối hình học đơn giản, mô tả bằng hộp bao thẳng trục (min/max, mét).
// Toạ độ y tính từ mặt sàn của khu đang xem.
export type Shape = 'box' | 'cylinder' | 'sphere'

export interface Prim {
	shape: Shape
	min: [number, number, number]
	max: [number, number, number]
	color: string
	glass?: boolean // kính trong suốt, không đổ bóng
	glow?: boolean // đèn: tự phát sáng, không đổ bóng
	solid?: boolean // mặc định: chặn người đi nếu cắt ngang thân người
	top?: number // cylinder: tỉ lệ bán kính đỉnh / đáy (0 = hình nón)
}

type Opts = Partial<Pick<Prim, 'glass' | 'glow' | 'solid' | 'top'>>

export const box = (
	x0: number,
	x1: number,
	y0: number,
	y1: number,
	z0: number,
	z1: number,
	color: string,
	o: Opts = {}
): Prim => ({ shape: 'box', min: [x0, y0, z0], max: [x1, y1, z1], color, ...o })

export const cyl = (
	cx: number,
	cz: number,
	r: number,
	y0: number,
	y1: number,
	color: string,
	o: Opts = {}
): Prim => ({
	shape: 'cylinder',
	min: [cx - r, y0, cz - r],
	max: [cx + r, y1, cz + r],
	color,
	...o,
})

export const ball = (
	cx: number,
	cz: number,
	rx: number,
	y0: number,
	y1: number,
	color: string,
	o: Opts = {}
): Prim => ({
	shape: 'sphere',
	min: [cx - rx, y0, cz - rx],
	max: [cx + rx, y1, cz + rx],
	color,
	...o,
})

// Dời cả nhóm khối theo trục y (dùng khi đổi hệ toạ độ thế giới -> khu)
export function shiftY(prims: Prim[], dy: number): Prim[] {
	return prims.map((p) => ({
		...p,
		min: [p.min[0], p.min[1] + dy, p.min[2]],
		max: [p.max[0], p.max[1] + dy, p.max[2]],
	}))
}

// Dải chiều cao của thân người tính từ sàn: khối nào cắt dải này mới chặn đường
const BODY_LOW = 0.15
const BODY_HIGH = 1.6

export function collidersOf(prims: Prim[]): Rect[] {
	return prims
		.filter((p) => p.solid !== false && p.min[1] < BODY_HIGH && p.max[1] > BODY_LOW)
		.map((p) => ({ minX: p.min[0], maxX: p.max[0], minZ: p.min[2], maxZ: p.max[2] }))
}
