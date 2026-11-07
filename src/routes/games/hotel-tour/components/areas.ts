import { ball, box, collidersOf, cyl, shiftY, type Prim } from './prims'
import type { Rect } from './walk'

// Khách sạn ven biển: biển ở phía -Z, mặt tiền toà nhà nằm trên z = 0, toà nhà kéo dài về +Z.
// Mỗi khu là một cảnh riêng; prims tính theo sàn của khu (y = 0 là mặt sàn).

export type AreaId = 'room' | 'rooftop' | 'lobby'

export interface Area {
	id: AreaId
	label: string
	caption: string
	floorY: number // độ cao mặt sàn so với mặt biển (mét)
	spawn: { x: number; z: number; yaw: number }
	bounds: Rect // vùng người xem được phép đứng (dùng để kiểm tra)
	shadow: { cx: number; cz: number; half: number } // vùng nhận bóng nắng
	prims: Prim[]
	colliders: Rect[]
}

const C = {
	wall: '#efe9df',
	ext: '#e9e1d3',
	slab: '#dcd3c4',
	window: '#5f7f92',
	floor: '#c9a27c',
	tile: '#d8d2c6',
	marble: '#e9e4da',
	white: '#f7f5f0',
	wood: '#b98a5e',
	dark: '#6b4a32',
	fabric: '#d9cbb5',
	sage: '#8fa9a3',
	accent: '#2f8f8a',
	coral: '#e07a5f',
	glass: '#cfe9f5',
	frame: '#4a4f55',
	metal: '#a3abb1',
	pot: '#c9b49a',
	leaf: '#4f7f3a',
	deck: '#a77b55',
	lamp: '#ffe7b8',
	water: '#3fb6c9',
	gold: '#c9a45c',
	trunk: '#8a6d4f',
}

// ---------- Toà nhà (toạ độ thế giới) ----------

const B_X = 16.2 // nửa bề ngang toà nhà
const B_Z = 14.2 // chiều sâu toà nhà
const FLOOR_H = 3.2
const ROOF_Y = 28.8 // sảnh cao 2 tầng (0..6.4), phòng ở tầng 2..8
const ROOM_FLOOR = 5 // tầng của phòng mẫu
const COLUMNS = [-12.8, -6.4, 0, 6.4, 12.8] // tâm từng phòng dọc mặt tiền
const BALCONY = 1.8

// Khối đặc của toà nhà, chừa một lỗ cho khu đang xem
function buildingMass(hole?: [x0: number, x1: number, y0: number, y1: number]): Prim[] {
	const o = { solid: false }
	if (!hole) return [box(-B_X, B_X, 0, ROOF_Y, 0, B_Z, C.ext, o)]
	const [x0, x1, y0, y1] = hole
	const parts: Prim[] = []
	if (y0 > 0) parts.push(box(-B_X, B_X, 0, y0, 0, B_Z, C.ext, o))
	parts.push(box(-B_X, B_X, y1, ROOF_Y, 0, B_Z, C.ext, o))
	parts.push(box(-B_X, x0, y0, y1, 0, B_Z, C.ext, o))
	parts.push(box(x1, B_X, y0, y1, 0, B_Z, C.ext, o))
	return parts
}

// Ban công + cửa kính của các phòng ở mặt tiền; bỏ qua phòng `skip`
function facade(skip?: { floor: number; column: number }): Prim[] {
	const o = { solid: false }
	const out: Prim[] = []
	for (let k = 2; k <= 8; k++) {
		const y = k * FLOOR_H
		for (const x of COLUMNS) {
			if (skip && skip.floor === k && skip.column === x) continue
			out.push(
				box(x - 3, x + 3, y + 0.05, y + 2.75, -0.04, 0, C.window, o),
				box(x - 3.2, x + 3.2, y - 0.15, y, -BALCONY, 0, C.slab, o),
				box(x - 3.2, x + 3.2, y, y + 1, -BALCONY, -BALCONY + 0.04, C.glass, { ...o, glass: true }),
				box(x - 3.2, x + 3.2, y + 1, y + 1.05, -BALCONY - 0.02, -BALCONY + 0.06, C.frame, o)
			)
		}
		// vách ngăn giữa các ban công
		for (let b = -B_X + 0.2; b <= B_X; b += 6.4) {
			if (skip && skip.floor === k && Math.abs(Math.abs(b) - 3.2) < 0.01) continue
			out.push(box(b - 0.06, b + 0.06, y, y + FLOOR_H - 0.15, -BALCONY, 0, C.ext, o))
		}
	}
	// mái che ban công tầng trên cùng
	out.push(box(-B_X, B_X, ROOF_Y - 0.15, ROOF_Y, -BALCONY, 0, C.slab, o))
	return out
}

// ---------- Cảnh xung quanh (toạ độ thế giới, chỉ để nhìn) ----------

function palm(x: number, z: number, h: number): Prim[] {
	const o = { solid: false }
	return [
		cyl(x, z, 0.2, 0, h, C.trunk, { ...o, top: 0.6 }),
		ball(x, z, 2.4, h - 0.6, h + 0.5, C.leaf, o),
		ball(x + 0.8, z - 0.4, 1.4, h - 1, h + 0.2, '#5e8f45', o),
	]
}

function beachUmbrella(x: number, z: number, color: string): Prim[] {
	const o = { solid: false }
	return [
		cyl(x, z, 0.04, 0, 2.3, C.white, o),
		cyl(x, z, 1.3, 1.9, 2.4, color, { ...o, top: 0.04 }),
		box(x - 0.35, x + 0.35, 0, 0.3, z + 0.6, z + 2.4, C.white, o),
	]
}

function surroundings(): Prim[] {
	const o = { solid: false }
	const out: Prim[] = []

	// các khách sạn lân cận dọc bờ biển
	const neighbours: [number, number, number, number, number, string][] = [
		[-62, -30, 4, 22, 22, '#ece4d4'],
		[-100, -72, 0, 18, 34, '#dbe0e2'],
		[-150, -118, 8, 30, 18, '#efe6d2'],
		[30, 54, 6, 24, 16, '#efe4cf'],
		[64, 94, 2, 20, 28, '#dfe6e6'],
		[112, 142, 5, 25, 24, '#f1e8da'],
	]
	for (const [x0, x1, z0, z1, h, color] of neighbours) {
		out.push(box(x0, x1, 0, h, z0, z1, color, o))
		// dải cửa sổ ngang mỗi tầng
		for (let y = 3.6; y < h - 1; y += 3.2) {
			out.push(box(x0 + 1, x1 - 1, y, y + 1.6, z0 - 0.05, z0, C.window, o))
		}
	}

	// thị trấn phía sau: khối nhà giả ngẫu nhiên (cố định giữa các lần chạy)
	let seed = 7
	const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
	const town = ['#e7dccb', '#d9d2c4', '#efe8dc', '#cfd6d8', '#e4cfc0']
	for (let i = 0; i < 48; i++) {
		const x = -320 + rand() * 640
		const z = 50 + rand() * 360
		const w = 10 + rand() * 22
		const d = 10 + rand() * 22
		const h = 6 + rand() * rand() * 40
		out.push(box(x, x + w, 0, h, z, z + d, town[i % town.length], o))
	}

	// đồi xa
	out.push(
		ball(-900, 1500, 800, -200, 260, '#5d7a52', o),
		ball(300, 1800, 1000, -250, 380, '#56744d', o),
		ball(1400, 1300, 700, -200, 220, '#61804f', o)
	)

	// hàng dừa + dù trên bãi cát
	const palms: [number, number, number][] = [
		[-12, -9, 7.5],
		[-19, -15, 8.5],
		[-27, -8, 7],
		[12, -10, 8],
		[20, -16, 7.2],
		[29, -7, 8.8],
		[-42, -13, 7.8],
		[44, -12, 7.4],
	]
	for (const [x, z, h] of palms) out.push(...palm(x, z, h))
	const umbrellas: [number, number, string][] = [
		[-8, -24, C.accent],
		[-2, -25, C.coral],
		[4, -24, C.accent],
		[10, -25, C.coral],
		[-16, -26, C.coral],
		[18, -27, C.accent],
	]
	for (const [x, z, color] of umbrellas) out.push(...beachUmbrella(x, z, color))
	return out
}

// Lan can kính chạy theo một cạnh thẳng trục
function railing(x0: number, x1: number, z0: number, z1: number, h = 1.05): Prim[] {
	return [
		box(x0, x1, 0, h, z0, z1, C.glass, { glass: true }),
		box(x0 - 0.02, x1 + 0.02, h, h + 0.05, z0 - 0.03, z1 + 0.03, C.frame),
	]
}

function plant(x: number, z: number, r = 0.3, h = 1.3): Prim[] {
	return [cyl(x, z, r, 0, r * 2, C.pot, { top: 1.15 }), ball(x, z, r * 1.5, r * 1.6, h, C.leaf)]
}

// ---------- Phòng mặt tiền (tầng 5, giữa mặt tiền) ----------

function roomPrims(): Prim[] {
	const H = 2.9
	const glass = { glass: true }
	return [
		// vỏ phòng
		box(-3.2, 3.2, -0.1, 0, 0, 9.2, C.floor),
		box(-3.2, 3.2, H, H + 0.2, 0, 9.2, C.white),
		box(-3.2, -3, 0, H, 0, 9.2, C.wall),
		box(3, 3.2, 0, H, 0, 9.2, C.wall),
		box(-3.2, 3.2, 0, H, 9, 9.2, C.wall),
		box(1, 2, 0, 2.1, 8.95, 9, C.dark), // cửa ra hành lang
		// vách kính hướng biển: nửa trái cố định, nửa phải mở ra ban công
		box(-3.2, 3.2, 2.5, H, -0.1, 0.1, C.wall),
		box(-3, 3, -0.02, 0.02, -0.06, 0.06, C.frame, { solid: false }),
		box(-3.05, -2.95, 0, 2.5, -0.06, 0.06, C.frame),
		box(-0.05, 0.05, 0, 2.5, -0.06, 0.06, C.frame),
		box(2.95, 3.05, 0, 2.5, -0.06, 0.06, C.frame),
		box(-2.95, -0.05, 0, 2.5, -0.015, 0.015, C.glass, glass),
		box(-2.9, -0.1, 0, 2.5, 0.05, 0.08, C.glass, glass), // cánh trượt nằm sau cánh cố định

		// ban công
		box(-3, 3, -0.15, 0, -BALCONY, 0, C.tile),
		box(-3.2, -3, 0, H + 0.15, -BALCONY, 0, C.ext),
		box(3, 3.2, 0, H + 0.15, -BALCONY, 0, C.ext), // mái che ban công là sàn ban công tầng trên (facade)
		...railing(-3, 3, -BALCONY, -BALCONY + 0.04, 1),
		cyl(1.5, -0.95, 0.3, 0, 0.65, C.white),
		box(0.5, 1.0, 0, 0.45, -1.2, -0.75, C.wood),
		box(0.5, 1.0, 0.45, 0.85, -0.8, -0.75, C.wood),
		box(2.0, 2.5, 0, 0.45, -1.2, -0.75, C.wood),
		box(2.0, 2.5, 0.45, 0.85, -0.8, -0.75, C.wood),
		...plant(-2.5, -1.2, 0.25, 1.2),

		// giường đôi, đầu giường áp tường trái
		box(-3, -0.9, 0, 0.35, 2.7, 4.5, '#8a6a4f'),
		box(-2.95, -0.95, 0.35, 0.6, 2.75, 4.45, C.white),
		box(-1.6, -0.92, 0.6, 0.63, 2.73, 4.47, C.accent, { solid: false }),
		box(-3, -2.9, 0, 1.25, 2.5, 4.7, C.dark),
		box(-2.85, -2.45, 0.6, 0.78, 2.9, 3.55, C.white, { solid: false }),
		box(-2.85, -2.45, 0.6, 0.78, 3.65, 4.3, C.white, { solid: false }),
		box(-2.99, -2.97, 1.45, 2.05, 3.0, 4.2, C.sage, { solid: false }), // tranh
		box(-3, -2.55, 0, 0.5, 2.0, 2.45, C.wood),
		box(-3, -2.55, 0, 0.5, 4.75, 5.2, C.wood),
		cyl(-2.77, 2.22, 0.12, 0.5, 0.85, C.lamp, { glow: true, top: 0.7 }),
		cyl(-2.77, 4.97, 0.12, 0.5, 0.85, C.lamp, { glow: true, top: 0.7 }),

		// kệ TV đối diện giường
		box(2.55, 3, 0, 0.5, 2.8, 4.4, C.wood),
		box(2.93, 2.97, 0.95, 1.65, 3.0, 4.2, '#1a1d21'),

		// sofa + bàn trà cạnh cửa kính
		box(-3, -2.15, 0, 0.42, 0.6, 2.2, C.fabric),
		box(-3, -2.8, 0.42, 0.85, 0.6, 2.2, C.fabric),
		box(-2.8, -2.15, 0.42, 0.62, 0.6, 0.75, C.fabric),
		box(-2.8, -2.15, 0.42, 0.62, 2.05, 2.2, C.fabric),
		cyl(-1.6, 1.4, 0.35, 0, 0.42, C.wood),

		// bàn làm việc
		box(2.4, 3, 0.72, 0.76, 0.6, 1.8, C.wood),
		box(2.4, 3, 0, 0.72, 0.6, 0.65, C.wood),
		box(2.4, 3, 0, 0.72, 1.75, 1.8, C.wood),
		box(1.85, 2.3, 0, 0.47, 1.0, 1.45, C.sage),
		box(1.8, 1.85, 0.47, 0.95, 1.0, 1.45, C.sage),

		// thảm, đèn trần
		box(-1.9, 1.2, 0, 0.01, 1.0, 5.6, '#cdbfa8'),
		cyl(0, 4, 0.3, H - 0.08, H, C.lamp, { glow: true }),

		// phòng tắm (đóng) + tủ áo ở lối vào
		box(-3, -0.9, 0, H, 6.2, 6.3, C.wall),
		box(-1, -0.9, 0, H, 6.3, 9, C.wall),
		box(-0.89, -0.86, 0, 2.1, 7.2, 8.0, C.dark),
		box(2.4, 3, 0, 2.4, 6.4, 8.4, '#d2b48f'),
		...plant(2.65, 5.4, 0.22, 1.1),
	]
}

// ---------- Sảnh lễ tân (tầng trệt, nhìn ra hiên và bãi biển) ----------

const LOBBY_FLOOR = 0.6

function lobbyPrims(): Prim[] {
	const H = 5.8
	const glass = { glass: true }
	const mullions = [-8, -4, -1.5, 1.5, 4, 8]
	const panes: [number, number][] = [
		[-8, -4],
		[-4, -1.5],
		[1.5, 4],
		[4, 8],
	]
	return [
		// vỏ sảnh
		box(-8.2, 8.2, -LOBBY_FLOOR, 0, 0, 12.2, C.marble),
		box(-8.2, 8.2, H, H + 0.2, 0, 12.2, C.white),
		box(-8.2, -8, 0, H, 0, 12.2, C.wall),
		box(8, 8.2, 0, H, 0, 12.2, C.wall),
		box(-8.2, 8.2, 0, H, 12, 12.2, C.wall),
		// vách kính cao, giữa mở ra hiên
		box(-8.2, 8.2, 4.6, H, -0.1, 0.1, C.wall),
		...mullions.map((x) => box(x - 0.06, x + 0.06, 0, 4.6, -0.06, 0.06, C.frame)),
		...panes.map(([a, b]) => box(a, b, 0, 4.6, -0.015, 0.015, C.glass, glass)),

		// quầy lễ tân + vách gỗ phía sau
		box(-3, 3, 0, 1.1, 8.4, 9.2, C.white),
		box(-3.1, 3.1, 1.1, 1.16, 8.3, 9.3, C.dark),
		box(-3, 3, 0, 0.12, 8.38, 8.42, C.gold, { solid: false }),
		box(-3.5, 3.5, 0, 0.9, 11.4, 12, C.wood),
		box(-3.5, 3.5, 0.3, 4.4, 11.92, 12, '#9c7350', { solid: false }),
		cyl(0, 11.9, 0.6, 2.6, 2.62, C.gold, { solid: false }),

		// thang máy (tường trái) + cửa chính (tường phải)
		box(-7.99, -7.94, 0, 2.4, 8.5, 9.7, C.metal),
		box(-7.99, -7.94, 0, 2.4, 10.3, 11.5, C.metal),
		box(7.94, 7.99, 0, 2.8, 4.8, 7.2, '#33464f'),

		// cột
		cyl(-5.5, 4.5, 0.35, 0, H, C.white),
		cyl(5.5, 4.5, 0.35, 0, H, C.white),
		cyl(-5.5, 8.8, 0.35, 0, H, C.white),
		cyl(5.5, 8.8, 0.35, 0, H, C.white),

		// khu ngồi chờ hai bên, nhìn ra biển
		box(-6.6, -2.6, 0, 0.01, 1.4, 4.6, '#cdbfa8'),
		box(-6.2, -3, 0, 0.42, 3.3, 4.1, C.sage),
		box(-6.2, -3, 0.42, 0.9, 3.9, 4.1, C.sage),
		box(-5.3, -3.9, 0, 0.4, 2.1, 2.8, C.dark),
		box(-6.3, -5.6, 0, 0.42, 1.6, 2.3, C.fabric),
		box(-3.6, -2.9, 0, 0.42, 1.6, 2.3, C.fabric),
		box(2.6, 6.6, 0, 0.01, 1.4, 4.6, '#cdbfa8'),
		box(3, 6.2, 0, 0.42, 3.3, 4.1, C.sage),
		box(3, 6.2, 0.42, 0.9, 3.9, 4.1, C.sage),
		box(3.9, 5.3, 0, 0.4, 2.1, 2.8, C.dark),
		box(2.9, 3.6, 0, 0.42, 1.6, 2.3, C.fabric),
		box(5.6, 6.3, 0, 0.42, 1.6, 2.3, C.fabric),

		// cây + đèn chùm
		...plant(-7.4, 0.8, 0.35, 1.8),
		...plant(7.4, 0.8, 0.35, 1.8),
		...plant(-7.4, 7.4, 0.3, 1.5),
		...plant(7.4, 10.8, 0.35, 1.8),
		cyl(0, 5, 0.03, 4.8, H, C.metal),
		cyl(0, 5, 1.2, 4.55, 4.8, C.lamp, { glow: true }),

		// hiên gỗ trước sảnh
		box(-8.2, 8.2, -LOBBY_FLOOR, 0, -6, 0, C.deck),
		...railing(-8, 8, -6, -5.97),
		...railing(-8.2, -8.17, -6, 0),
		...railing(8.17, 8.2, -6, 0),
		box(-6.5, -5.8, 0, 0.35, -4.8, -3.2, C.white),
		box(-6.5, -5.8, 0.35, 0.75, -3.25, -2.85, C.white),
		box(-5.2, -4.5, 0, 0.35, -4.8, -3.2, C.white),
		box(-5.2, -4.5, 0.35, 0.75, -3.25, -2.85, C.white),
		cyl(-5.15, -4.0, 0.035, 0, 2.4, C.white),
		cyl(-5.15, -4.0, 1.4, 2.05, 2.5, C.accent, { top: 0.05 }),
		cyl(4.5, -3, 0.45, 0, 0.75, C.white),
		box(3.6, 4.0, 0, 0.45, -3.2, -2.8, C.wood),
		box(5.0, 5.4, 0, 0.45, -3.2, -2.8, C.wood),
		cyl(4.5, -3, 0.035, 0, 2.4, C.white),
		cyl(4.5, -3, 1.4, 2.05, 2.5, C.coral, { top: 0.05 }),
		...plant(-7.5, -5.4, 0.3, 1.4),
		...plant(7.5, -5.4, 0.3, 1.4),
	]
}

// ---------- Bar sân thượng ----------

function rooftopPrims(): Prim[] {
	const stools = [-3, -1.8, -0.6, 0.6, 1.8, 3].flatMap((x) => [
		cyl(x, 9.6, 0.04, 0, 0.72, C.metal),
		cyl(x, 9.6, 0.2, 0.72, 0.8, C.accent),
	])
	const tables = [3.5, 7, 10.5, 14].flatMap((x) => [
		cyl(x, 1.3, 0.35, 0, 1.05, C.white),
		cyl(x - 0.7, 1.3, 0.18, 0, 0.75, C.wood),
		cyl(x + 0.7, 1.3, 0.18, 0, 0.75, C.wood),
		cyl(x, 1.3, 0.035, 1.05, 2.5, C.white, { solid: false }),
		cyl(x, 1.3, 1.4, 2.1, 2.55, x % 2 ? C.coral : C.accent, { top: 0.05, solid: false }),
	])
	const bottles = Array.from({ length: 14 }, (_, i) =>
		cyl(
			-3.4 + i * 0.5,
			13.55,
			0.05,
			1.3,
			1.6,
			['#3f6f4f', '#a9673b', '#d8c99c', '#5a4a7a'][i % 4],
			{
				solid: false,
			}
		)
	)
	return [
		// sàn gỗ + lan can kính trên gờ bê tông bốn phía
		box(-B_X, B_X, -0.05, 0, 0, B_Z, C.deck),
		box(-B_X, B_X, 0, 0.3, -0.2, 0, C.ext),
		box(-B_X - 0.2, -B_X, 0, 0.3, -0.2, B_Z, C.ext),
		box(B_X, B_X + 0.2, 0, 0.3, -0.2, B_Z, C.ext),
		box(-B_X - 0.2, B_X + 0.2, 0, 0.3, B_Z, B_Z + 0.2, C.ext),
		...shiftY(railing(-B_X, B_X, -0.12, -0.08, 0.85), 0.3),
		...shiftY(railing(-B_X - 0.12, -B_X - 0.08, -0.2, B_Z, 0.85), 0.3),
		...shiftY(railing(B_X + 0.08, B_X + 0.12, -0.2, B_Z, 0.85), 0.3),
		...shiftY(railing(-B_X, B_X, B_Z + 0.08, B_Z + 0.12, 0.85), 0.3),

		// quầy bar có giàn che
		box(-4, 4, 0, 1.1, 10.2, 11, C.white),
		box(-4.1, 4.1, 1.1, 1.16, 10.1, 11.1, C.dark),
		box(-4, -3.8, 0, 1.1, 11, 12.6, C.white),
		box(3.8, 4, 0, 1.1, 11, 12.6, C.white),
		box(-4, 4, 0, 2.4, 13.3, 13.8, C.wood),
		box(-3.9, 3.9, 1.25, 1.29, 13.1, 13.3, C.dark, { solid: false }),
		...bottles,
		...stools,
		box(-5, 5, 3, 3.2, 9.4, 14, C.wood, { solid: false }),
		cyl(-4.8, 9.6, 0.1, 0, 3, C.wood),
		cyl(4.8, 9.6, 0.1, 0, 3, C.wood),
		box(-4.5, 4.5, 2.88, 2.92, 10.4, 10.44, C.lamp, { glow: true, solid: false }),

		// hồ bơi nhỏ góc trái
		box(-15.2, -7.8, 0, 0.45, 0.8, 6.2, '#e7e1d6'),
		box(-15, -8, 0.45, 0.47, 1, 6, C.water, { solid: false }),
		box(-15, -13.8, 0, 0.35, 7.2, 9.2, C.white),
		box(-15, -13.8, 0.35, 0.7, 8.8, 9.2, C.white),
		box(-12.4, -11.2, 0, 0.35, 7.2, 9.2, C.white),
		box(-12.4, -11.2, 0.35, 0.7, 8.8, 9.2, C.white),
		cyl(-12.6, 8.2, 0.035, 0, 2.4, C.white),
		cyl(-12.6, 8.2, 1.4, 2.05, 2.5, C.accent, { top: 0.05 }),

		// sofa lounge nhìn ra biển
		box(-5, -1, 0, 0.4, 5, 5.8, C.fabric),
		box(-5, -1, 0.4, 0.85, 5.6, 5.8, C.fabric),
		box(-4, -2, 0, 0.35, 3.6, 4.4, C.wood),
		box(1, 5, 0, 0.4, 5, 5.8, C.sage),
		box(1, 5, 0.4, 0.85, 5.6, 5.8, C.sage),
		box(2, 4, 0, 0.35, 3.6, 4.4, C.wood),

		// bàn cao + dù dọc lan can phía biển
		...tables,

		// buồng thang máy + bồn cây
		box(10, 15.8, 0, 3, 10, 13.8, C.ext),
		box(10.6, 11.8, 0, 2.2, 9.96, 10, C.metal),
		box(15, 15.9, 0, 0.6, 3, 8.6, C.pot),
		ball(15.45, 5.8, 0.6, 0.5, 1.4, C.leaf, { solid: false }),
		ball(15.45, 4.0, 0.55, 0.5, 1.3, C.leaf, { solid: false }),
		ball(15.45, 7.4, 0.5, 0.5, 1.2, C.leaf, { solid: false }),
		...plant(-6.5, 13.2, 0.35, 1.7),
		...plant(6.2, 13.2, 0.35, 1.7),
	]
}

// ---------- Ghép ----------

function makeArea(base: Omit<Area, 'colliders' | 'prims'>, local: Prim[], world: Prim[]): Area {
	const prims = [...local, ...shiftY(world, -base.floorY)]
	return { ...base, prims, colliders: collidersOf(local) }
}

export function createAreas(): Area[] {
	const roomY = ROOM_FLOOR * FLOOR_H
	const around = surroundings()
	return [
		makeArea(
			{
				id: 'room',
				label: 'Phòng mặt tiền',
				caption: 'Deluxe hướng biển · 54 m² · ban công riêng',
				floorY: roomY,
				spawn: { x: 0.8, z: 6, yaw: 0 },
				bounds: { minX: -3, maxX: 3, minZ: -BALCONY, maxZ: 9 },
				shadow: { cx: 0, cz: 3.5, half: 9 },
			},
			roomPrims(),
			[
				...buildingMass([-3.2, 3.2, roomY - 0.15, roomY + FLOOR_H]),
				...facade({ floor: ROOM_FLOOR, column: 0 }),
				...around,
			]
		),
		makeArea(
			{
				id: 'rooftop',
				label: 'Bar sân thượng',
				caption: 'Quầy bar ngoài trời · hồ bơi nhỏ · tầng thượng',
				floorY: ROOF_Y,
				spawn: { x: 0, z: 7.5, yaw: 0 },
				bounds: { minX: -B_X, maxX: B_X, minZ: -0.2, maxZ: B_Z },
				shadow: { cx: 0, cz: 7, half: 19 },
			},
			rooftopPrims(),
			[...buildingMass(), ...facade(), ...around]
		),
		makeArea(
			{
				id: 'lobby',
				label: 'Sảnh lễ tân',
				caption: 'Sảnh cao hai tầng · hiên gỗ nhìn ra bãi biển',
				floorY: LOBBY_FLOOR,
				spawn: { x: 0, z: 7, yaw: 0 },
				bounds: { minX: -8.2, maxX: 8.2, minZ: -6, maxZ: 12 },
				shadow: { cx: 0, cz: 3, half: 14 },
			},
			lobbyPrims(),
			[...buildingMass([-8.2, 8.2, 0, 2 * FLOOR_H]), ...facade(), ...around]
		),
	]
}
