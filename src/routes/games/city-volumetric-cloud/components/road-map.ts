import { GRID, ROAD_ASSETS, type RoadAsset } from './road-assets'

// Toạ độ theo đơn vị ô (0..GRID) là vị trí gốc của model; y theo đơn vị kit (1 ô = 1).
// rot: số lần xoay 90° quanh trục Y. Xoay k lần biến hướng d thành (d + k) % 4.
export type Placement = { asset: RoadAsset; x: number; z: number; y?: number; rot?: number }

// Hướng: Đông (+x), Bắc (-z), Tây (-x), Nam (+z)
export const E = 0
export const N = 1
export const W = 2
export const S = 3

export const LEVEL = 0.25 // một bậc độ cao (road-slant cao đúng 0.25)

// Cạnh mở của tile ở rot 0: [x, z, hướng, bậc] tính từ gốc model.
type Opening = [x: number, z: number, dir: number, level?: number]
type TileSpec = { size: [number, number]; open: Opening[]; levels?: number[] }

const straight: TileSpec = {
	size: [1, 1],
	open: [
		[0.5, 0, E],
		[-0.5, 0, W],
	],
}
const end: TileSpec = { size: [1, 1], open: [[0.5, 0, E]] }
const tJunction: TileSpec = {
	size: [1, 1],
	open: [
		[0.5, 0, E],
		[-0.5, 0, W],
		[0, 0.5, S],
	],
}
const crossroad: TileSpec = { size: [1, 1], open: [...tJunction.open, [0, -0.5, N]] }
const bend: TileSpec = {
	size: [1, 1],
	open: [
		[-0.5, 0, W],
		[0, 0.5, S],
	],
}
const curve: TileSpec = {
	size: [2, 2],
	open: [
		[-1, -0.5, W],
		[0.5, 1, S],
	],
}
const slant = (rise: number, length = 1): TileSpec => ({
	size: [length, 1],
	open: [
		[-length / 2, 0, W, 0],
		[length / 2, 0, E, rise],
	],
})

// Số liệu đo từ chính các file GLB (xem docs trong plan).
export const TILES: Partial<Record<RoadAsset, TileSpec>> = {
	'road-straight': straight,
	'road-crossing': straight,
	'road-driveway-single': straight, // lối vào nhà ở phía Nam
	'road-driveway-double': straight, // lối vào nhà ở cả Bắc và Nam
	'road-side': straight, // làn phụ lấn 0.31 ô sang phía Bắc
	'road-side-entry': straight,
	'road-side-exit': straight,
	'road-straight-half': {
		size: [0.5, 1],
		open: [
			[0.25, 0, E],
			[-0.25, 0, W],
		],
	},
	'road-end': end,
	'road-end-round': end,
	'road-intersection': tJunction,
	'road-intersection-line': tJunction,
	'road-intersection-path': tJunction,
	'road-crossroad': crossroad,
	'road-crossroad-line': crossroad,
	'road-crossroad-path': crossroad,
	'road-bend': bend,
	'road-bend-sidewalk': bend,
	'road-bend-square': bend,
	'road-curve': curve,
	'road-curve-pavement': curve,
	'road-curve-intersection': { size: [2, 2], open: [...curve.open, [1, -0.5, E]] },
	'road-roundabout': {
		size: [3, 3],
		open: [
			[1.5, 0, E],
			[0, -1.5, N],
			[-1.5, 0, W],
			[0, 1.5, S],
		],
	},
	// hai làn ở phía Tây nhập thành một làn ở giữa cạnh Đông
	'road-split': {
		size: [1, 2],
		open: [
			[-0.5, -0.5, W],
			[-0.5, 0.5, W],
			[0.5, 0, E],
		],
	},
	'road-square': { size: [1, 1], open: [] },
	'road-slant': slant(1),
	'road-slant-flat': slant(1), // bản mỏng, không có khối đặc bên dưới
	'road-slant-high': slant(2),
	'road-slant-flat-high': slant(2),
	'road-slant-curve': slant(2, 2),
	'road-slant-flat-curve': slant(2, 2),
	// cầu vượt: đường dưới đất theo trục X, mặt cầu cao 0.5 theo trục Z
	'road-bridge': {
		size: [1, 1],
		open: [...straight.open, [0, -0.5, N, 2], [0, 0.5, S, 2]],
		levels: [0, 2],
	},
}

// Lớp rào chắn đặt chồng lên tile đường: [asset, rot lệch so với tile gốc, y lệch].
export const BARRIERS: Partial<Record<RoadAsset, [RoadAsset, number, number?]>> = {
	'road-straight': ['road-straight-barrier', 1],
	'road-straight-half': ['road-straight-barrier-half', 1],
	'road-bend': ['road-bend-barrier', 0],
	'road-bend-square': ['road-bend-square-barrier', 0],
	'road-crossroad': ['road-crossroad-barrier', 0],
	'road-crossroad-line': ['road-crossroad-barrier', 0],
	'road-crossroad-path': ['road-crossroad-barrier', 0],
	'road-intersection': ['road-intersection-barrier', 0],
	'road-intersection-line': ['road-intersection-barrier', 0],
	'road-intersection-path': ['road-intersection-barrier', 0],
	'road-curve': ['road-curve-barrier', 0],
	'road-curve-intersection': ['road-curve-intersection-barrier', 0],
	'road-driveway-single': ['road-driveway-single-barrier', 0],
	'road-driveway-double': ['road-driveway-double-barrier', 0],
	'road-end': ['road-end-barrier', 0],
	'road-end-round': ['road-end-round-barrier', 0],
	'road-roundabout': ['road-roundabout-barrier', 0],
	'road-side': ['road-side-barrier', 3],
	'road-side-entry': ['road-side-entry-barrier', 3],
	'road-side-exit': ['road-side-exit-barrier', 3],
	'road-slant': ['road-slant-barrier', 0],
	'road-slant-flat': ['road-slant-barrier', 0],
	'road-slant-high': ['road-slant-high-barrier', 0],
	'road-slant-flat-high': ['road-slant-high-barrier', 0],
	'road-slant-curve': ['road-slant-curve-barrier', 0],
	'road-slant-flat-curve': ['road-slant-curve-barrier', 0],
	'road-split': ['road-split-barrier', 0],
	'road-square': ['road-square-barrier', 0],
	'road-bridge': ['road-straight-barrier', 0, 0.5],
}

export function rotate(x: number, z: number, k: number): [number, number] {
	const c = [1, 0, -1, 0][k % 4]
	const s = [0, 1, 0, -1][k % 4]
	return [x * c + z * s, -x * s + z * c]
}

export function openings(p: Placement) {
	const k = p.rot ?? 0
	const base = Math.round((p.y ?? 0) / LEVEL)
	return (TILES[p.asset]?.open ?? []).map(([ox, oz, dir, level = 0]) => {
		const [dx, dz] = rotate(ox, oz, k)
		return { x: p.x + dx, z: p.z + dz, dir: (dir + k) % 4, level: base + level }
	})
}

export function footprint(p: Placement) {
	const [w, d] = TILES[p.asset]!.size
	const [fw, fd] = (p.rot ?? 0) % 2 ? [d, w] : [w, d]
	return { x0: p.x - fw / 2, z0: p.z - fd / 2, w: fw, d: fd }
}

// ---------------------------------------------------------------------------
// Bản đồ cố định 30 x 30 ô. Hàng = z (Bắc ở trên), cột = x (Tây bên trái).
//   #  đường (tự chọn thẳng / cua / ngã ba / ngã tư / cụt theo ô kề)
//   =  vạch qua đường     d  lối vào một bên     D  lối vào hai bên
//   P  bãi đỗ             Q  bãi đỗ có rào       o  vỉa hè lát gạch
//   *  ô thuộc tile đặc biệt (vòng xuyến, cua lớn, cầu, dốc...) đặt tay ở dưới
// Đường cao tốc trên cao (hàng 15) và cầu vượt (cột 14) nằm trên các ô '.'.
const MAP = [
	'..............................', // 0
	'..............................', // 1
	'..**##d###################**..', // 2
	'..**.oQo..#.......#.......**..', // 3
	'..#..######.......#........#..', // 4
	'..#..#.P..#.......#........#..', // 5
	'..#=d##D#=#.......#*******##..', // 6
	'..#oPooPo.#.......#........#..', // 7
	'..#.......=.......#........#..', // 8
	'..#......***......#........#..', // 9
	'..######=***=###############..', // 10
	'..#......***..#...#...#....#..', // 11
	'..#.......=...#...#...#....#..', // 12
	'..#.......#...#...#...#....#..', // 13
	'..#.......#...#...#...#....#..', // 14
	'..##**....*...*...*...*.**##..', // 15
	'..#.......#...#...#...#....#..', // 16
	'..#.......#...*...#...#....#..', // 17
	'..#.......#...*...=...#....#..', // 18
	'..#.......#......***..#....#..', // 19
	'..############*#=***=#######..', // 20
	'..#.....#.#......***..#oo#.#..', // 21
	'..#.....#.#...*...=...dPo#.#..', // 22
	'..#*******#...#...#...#oPd.#..', // 23
	'..#*******#...#...#...#Po#.#..', // 24
	'..#.......#...#...#...#D##.#..', // 25
	'..**......#...#...#....P..**..', // 26
	'.#**################****##**..', // 27
	'..............................', // 28
	'..............................', // 29
]

// Ô có biến thể riêng thay cho tile mặc định.
const VARIANTS: Record<string, RoadAsset> = {
	'10,20': 'road-crossroad-line',
	'18,10': 'road-crossroad-path',
	'14,10': 'road-intersection-path',
	'22,10': 'road-intersection-path',
	'5,4': 'road-bend',
	'22,25': 'road-bend-sidewalk',
	'25,25': 'road-bend-square',
	'8,22': 'road-end-round',
}

// Vành đai ngoài là đường có rào; thêm vài ô lẻ bên trong.
const EXTRA_BARRIERS = new Set(['5,4', '25,25', '22,20'])
const isRing = (x: number, z: number) => x === 2 || x === 27 || z === 2 || z === 27

const placements: Placement[] = []

function place(asset: RoadAsset, x: number, z: number, rot = 0, y = 0) {
	placements.push({ asset, x, z, rot: rot % 4, y })
}

// Đặt tile theo góc Tây-Bắc của footprint (x0, z0), kèm lớp rào nếu cần.
function tile(
	asset: RoadAsset,
	x0: number,
	z0: number,
	rot = 0,
	opts: { y?: number; barrier?: boolean } = {}
) {
	const [w, d] = TILES[asset]?.size ?? [1, 1]
	const [fw, fd] = rot % 2 ? [d, w] : [w, d]
	const x = x0 + fw / 2
	const z = z0 + fd / 2
	const y = opts.y ?? 0
	place(asset, x, z, rot, y)
	const barrier = BARRIERS[asset]
	if (opts.barrier && barrier) place(barrier[0], x, z, rot + barrier[1], y + (barrier[2] ?? 0))
}

// Gắn một chi tiết (đèn, biển) lên cột; offset tính trong hệ toạ độ của cột.
function mount(
	pole: RoadAsset,
	part: RoadAsset,
	x: number,
	z: number,
	rot: number,
	offset: number[]
) {
	const [ox, oy, oz] = offset
	const [dx, dz] = rotate(ox, oz, rot)
	place(pole, x, z, rot)
	place(part, x + dx, z + dz, rot, oy)
}

// --- Tile đặc biệt ---------------------------------------------------------

// Bốn góc vành đai: cua lớn 2x2
tile('road-curve', 2, 2, 1, { barrier: true })
tile('road-curve-pavement', 26, 2, 0)
tile('road-curve', 26, 26, 3, { barrier: true })
tile('road-curve-intersection', 2, 26, 2, { barrier: true }) // nhánh rẽ ra ngõ cụt (1, 27)

tile('road-roundabout', 9, 9)
tile('road-roundabout', 17, 19, 0, { barrier: true })

// Cao tốc trên cao chạy Đông-Tây ở hàng 15
tile('road-slant-curve', 4, 15, 0, { barrier: true })
for (const x of [6, 7, 8, 9, 11, 12, 13, 15, 16, 17, 19, 20, 21, 23])
	tile('road-straight', x, 15, 0, { y: 0.5, barrier: true })
for (const x of [10, 14, 18, 22]) tile('road-bridge', x, 15, 1, { barrier: true })
tile('road-slant-flat-curve', 24, 15, 2, { barrier: true })
place('road-straight-barrier-end', 3.5, 15.5, 3) // rào cao dần về phía dốc
place('road-straight-barrier-end', 26.5, 15.5, 1)

// Cầu vượt Bắc-Nam ở cột 14, bắc qua hàng 20
tile('road-slant-flat', 14, 17, 3, { barrier: true })
tile('road-slant-flat', 14, 18, 3, { y: 0.25, barrier: true })
tile('road-straight', 14, 19, 1, { y: 0.5, barrier: true })
tile('road-bridge', 14, 20, 0, { barrier: true })
tile('road-straight', 14, 21, 1, { y: 0.5, barrier: true })
tile('road-slant-flat-high', 14, 22, 1, { barrier: true })

// Đường lên đồi ở hàng 6: dốc đặc trên nền tile, có bãi đỗ trên đỉnh
tile('road-slant', 19, 6, 0, { barrier: true })
tile('road-straight', 20, 6, 0, { y: 0.25, barrier: true })
tile('road-slant', 21, 6, 0, { y: 0.25, barrier: true })
tile('road-straight', 22, 6, 0, { y: 0.5, barrier: true })
tile('road-driveway-double', 23, 6, 0, { y: 0.5, barrier: true })
tile('road-straight', 24, 6, 0, { y: 0.5, barrier: true })
tile('road-slant-high', 25, 6, 2, { barrier: true })
tile('road-square', 23, 5, 0, { y: 0.5, barrier: true })
tile('road-square', 23, 7, 0, { y: 0.5, barrier: true })
for (const z of [5, 6, 7]) {
	place('tile-high', 20.5, z + 0.5)
	place('tile-high', 21.5, z + 0.5)
	for (const x of [22, 23, 24]) {
		place('tile-high', x + 0.5, z + 0.5)
		place('tile-high', x + 0.5, z + 0.5, 0, 0.25)
	}
}
for (const z of [5, 7]) {
	place('tile-slant', 19.5, z + 0.5)
	place('tile-slant', 21.5, z + 0.5, 0, 0.25)
	place('tile-slantHigh', 25.5, z + 0.5, 2)
}

// Đại lộ hai làn ở hàng 23-24 nhập làn rồi kết thúc bằng vòng quay đầu
for (const x of [3, 4, 5]) {
	tile('road-straight', x, 23, 0, { barrier: true })
	tile('road-straight', x, 24, 0, { barrier: true })
}
tile('road-split', 6, 23, 0, { barrier: true })
tile('road-straight', 7, 23.5, 0, { barrier: true })
tile('road-straight-half', 8, 23.5, 0, { barrier: true })
tile('road-end-round', 8.5, 23.5, 2, { barrier: true })

// Làn phụ dừng xe trên vành đai phía Nam, lấn ra ngoài thành phố
tile('road-side-entry', 20, 27, 2, { barrier: true })
tile('road-side', 21, 27, 2, { barrier: true })
tile('road-side', 22, 27, 2, { barrier: true })
tile('road-side-exit', 23, 27, 2, { barrier: true })

// --- Đường tự ghép từ bản đồ ký tự -----------------------------------------

const ROAD_CHARS = '#=dD'
const STEP = [
	[1, 0],
	[0, -1],
	[-1, 0],
	[0, 1],
]
const charAt = (x: number, z: number) => MAP[z]?.[x] ?? '.'

// Cạnh mở mặt đất của các tile đặc biệt, để ô ký tự kế bên biết mà nối vào.
const featureEdges = new Set(
	placements
		.flatMap(openings)
		.filter((o) => o.level === 0)
		.map((o) => `${o.x},${o.z},${o.dir}`)
)

function connected(x: number, z: number, dir: number) {
	const [dx, dz] = STEP[dir]
	if (ROAD_CHARS.includes(charAt(x + dx, z + dz))) return true
	const edge = [x + 0.5 + dx / 2, z + 0.5 + dz / 2]
	return featureEdges.has(`${edge[0]},${edge[1]},${(dir + 2) % 4}`)
}

const isLot = (x: number, z: number) => 'PQ'.includes(charAt(x, z))

for (let z = 0; z < GRID; z++) {
	for (let x = 0; x < GRID; x++) {
		const c = charAt(x, z)
		if (c === 'o') place('tile-low', x + 0.5, z + 0.5)
		if (c === 'P' || c === 'Q') tile('road-square', x, z, 0, { barrier: c === 'Q' })
		if (!ROAD_CHARS.includes(c)) continue

		const dirs = [E, N, W, S].filter((d) => connected(x, z, d))
		const key = `${x},${z}`
		let asset: RoadAsset
		let rot: number
		if (dirs.length === 4) {
			asset = 'road-crossroad'
			rot = 0
		} else if (dirs.length === 3) {
			const missing = [E, N, W, S].find((d) => !dirs.includes(d))!
			asset = isRing(x, z) ? 'road-intersection-line' : 'road-intersection'
			rot = missing + 3 // ở rot 0 ngã ba thiếu nhánh Bắc
		} else if (dirs.length === 1) {
			asset = 'road-end'
			rot = dirs[0]
		} else if ((dirs[1] - dirs[0]) % 2 === 0) {
			// đường thẳng: rot 0 chạy Đông-Tây, rot 1 chạy Bắc-Nam
			asset =
				c === '='
					? 'road-crossing'
					: c === 'd'
						? 'road-driveway-single'
						: c === 'D'
							? 'road-driveway-double'
							: 'road-straight'
			const ns = dirs[0] === N
			// lối vào một bên ở phía Nam khi rot 0 -> xoay về phía có bãi đỗ
			rot = ns ? (isLot(x - 1, z) ? 3 : 1) : isLot(x, z - 1) ? 2 : 0
		} else {
			// cua: rot 0 nối Tây và Nam
			asset = 'road-bend'
			rot = [0, 1, 2, 3].find((k) => dirs.includes((W + k) % 4) && dirs.includes((S + k) % 4))!
		}
		asset = VARIANTS[key] ?? asset
		tile(asset, x, z, rot, { barrier: isRing(x, z) || EXTRA_BARRIERS.has(key) })
	}
}

// --- Đồ vật ven đường ------------------------------------------------------

// Trụ đỡ cao tốc; dưới đoạn dốc mỏng thì hạ trụ xuống cho vừa
for (const x of [6, 8, 9, 11, 13, 15, 17, 19, 21, 23]) place('bridge-pillar', x + 0.5, 15.5)
for (const x of [7, 12, 16, 20]) place('bridge-pillar-wide', x + 0.5, 15.5)
place('bridge-pillar-wide', 24.5, 15.5, 0, -0.08)
place('bridge-pillar-wide', 14.5, 19.5)
place('bridge-pillar-wide', 14.5, 21.5)
place('bridge-pillar', 14.5, 18.5, 0, -0.14)
place('bridge-pillar', 14.5, 22.5, 0, -0.27)

// Biển chỉ đường dạng cổng trên cao tốc và vành đai
place('sign-highway', 7.5, 15.5, 0, 0.5)
place('sign-highway-wide', 12.5, 15.5, 2, 0.5)
place('sign-highway-detailed', 20.5, 15.5, 0, 0.5)
place('sign-highway', 2.5, 12.5, 1)
place('sign-highway-wide', 27.5, 17.5, 3)
place('sign-highway-detailed', 16.5, 27.5, 2)

// Đèn đường: tay đèn ở rot 0 vươn về phía Bắc
for (const z of [3, 5, 7, 13, 17, 23, 25]) place('light-square', 10.06, z + 0.5, 3)
for (const z of [4, 8, 12, 16, 24, 26]) place('light-curved', 18.94, z + 0.5, 1)
for (const x of [4, 6, 13, 16, 20, 24]) place('light-square', x + 0.5, 10.06, 2)
for (const x of [4, 6, 12, 15, 21, 24]) place('light-curved', x + 0.5, 20.94, 0)
for (const x of [5, 8, 21, 24]) place('light-curved', x + 0.5, 2.06, 2)
for (const x of [6, 9, 12, 16]) place('light-curved', x + 0.5, 27.94, 0)
for (const z of [8, 13, 18]) place('light-square', 2.06, z + 0.5, 3)
for (const z of [8, 13, 18, 23]) place('light-square', 27.94, z + 0.5, 1)
place('light-square-double', 3.5, 24)
place('light-curved-double', 5.5, 24)
place('light-curved-cross', 10.5, 10.5)
place('light-square-cross', 18.5, 20.5)

// Đèn giao thông ở các ngã tư
const LIGHT_VERTICAL = [-0.013, 0.437, 0]
const LIGHT_HANGING = [-0.013, 0.438, -0.219]
const LIGHT_HORIZONTAL = [-0.013, 0.438, -0.17]
place('traffic-light', 10.06, 20.06)
place('traffic-light', 10.94, 20.94, 2)
place('traffic-light-hanging', 10.94, 20.06, 1)
place('traffic-light-hanging', 10.06, 20.94, 3)
mount('road-sign-empty', 'traffic-light-object-vertical', 18.06, 10.06, 0, LIGHT_VERTICAL)
mount('road-sign-empty', 'traffic-light-object-vertical', 18.94, 10.94, 2, LIGHT_VERTICAL)
mount('road-sign-empty-hanging', 'traffic-light-object-hanging', 18.94, 10.06, 1, LIGHT_HANGING)
mount(
	'road-sign-empty-hanging',
	'traffic-light-object-horizontal',
	18.06,
	10.94,
	3,
	LIGHT_HORIZONTAL
)
place('traffic-light', 22.06, 20.06)
mount('road-sign-empty-hanging', 'traffic-light-object-hanging', 22.94, 20.94, 1, LIGHT_HANGING)

// Biển báo
const SIGN_FACE = [-0.011, 0.425, 0]
place('road-sign-stop', 5.95, 5.85, 3)
place('road-sign-stop', 8.05, 21.15, 1)
mount('road-sign-empty', 'road-sign-object-stop', 14.06, 11.1, 1, SIGN_FACE)
place('road-sign-warning', 18.94, 7.3, 1)
mount('road-sign-empty', 'road-sign-object-warning', 7.3, 23.42, 0, SIGN_FACE)
place('road-sign-street', 10.95, 6.95)
mount('road-sign-empty', 'road-sign-object-street', 22.95, 10.95, 0, [0, 0.445, 0])

// Đường dây điện dọc phía Bắc hàng 20: cột cách nhau 0.5 ô, đoạn "wide" cách 1 ô
const POWER_Z = 19.9
place('electricity-pole', 3.25, POWER_Z)
place('electricity-wires', 3.75, POWER_Z)
place('electricity-pole-single', 4, POWER_Z)
place('electricity-wires', 4.25, POWER_Z)
place('electricity-pole-single', 4.5, POWER_Z)
place('electricity-wires', 4.75, POWER_Z)
place('electricity-pole', 5.25, POWER_Z)
place('electricity-wires-wide', 6, POWER_Z)
place('electricity-pole-wide', 7, POWER_Z)
place('electricity-wires-wide', 8, POWER_Z)
place('electricity-pole-single', 8.5, POWER_Z)

// Cột điện có tay vươn ra đường ở mép Bắc vành đai (xoay 180° để tay vươn về phía Nam)
const SIDE_Z = 2.18 // chân cột "side" lệch 0.26 so với gốc model
place('electricity-side', 11.75, SIDE_Z, 2)
place('electricity-wires', 12.25, SIDE_Z + 0.03, 2)
place('electricity-side-single', 12.5, SIDE_Z - 0.26, 2)
place('electricity-wires', 12.75, SIDE_Z + 0.03, 2)
place('electricity-side-single', 13, SIDE_Z - 0.26, 2)
place('electricity-wires-wide', 13.5, SIDE_Z + 0.03, 2)
place('electricity-side-wide', 14.5, SIDE_Z, 2)
place('electricity-wires-wide', 15.5, SIDE_Z + 0.03, 2)
place('electricity-side-single', 16, SIDE_Z - 0.26, 2)
place('electricity-wires', 16.25, SIDE_Z + 0.03, 2)
place('electricity-side-single', 16.5, SIDE_Z - 0.26, 2)

// Công trường ở cuối đại lộ cụt
for (const z of [23.75, 24, 24.25]) place('construction-barrier', 8.62, z)
place('construction-light', 8.62, 23.58)
place('construction-light', 8.62, 24.42)
for (const [x, z] of [
	[8.35, 23.8],
	[8.3, 24.05],
	[8.38, 24.3],
])
	place('construction-cone', x, z)
place('construction-fence', 9.15, 24)

place('dumpster', 7.5, 3.5)
place('dumpster', 24.5, 24.5, 1)

export const ROAD_MAP: Placement[] = placements

// Xếp toàn bộ asset thành lưới để xem từng model và hướng mặc định của nó.
export function gallery(): Placement[] {
	const cols = 10
	return ROAD_ASSETS.map((asset, i) => ({
		asset,
		x: 1.5 + (i % cols) * 3,
		z: 1.5 + Math.floor(i / cols) * 3,
	}))
}
