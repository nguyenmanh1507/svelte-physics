import { createRandom } from '#lib/components/volumetric-cloud/index.js'
import { buildingCells, type BuildingAsset } from './building-assets'
import { GRID } from './road-assets'
import { E, footprint, N, rotate, ROAD_MAP, S, TILES, W, type Placement } from './road-map'

// Vị trí building theo đơn vị ô như Placement của đường; rot: số lần xoay 90° quanh Y.
export type BuildingPlacement = { asset: BuildingAsset; x: number; z: number; rot: number }

const SEED = 20
const MIN_AREA = 6 // khu trống nhỏ hơn chừng này ô thì bỏ qua
const SKIP = 0.35 // bỏ ngẫu nhiên một phần ô mặt tiền để không nhồi kín
const DOWNTOWN = 6 // khoảng cách (ô) tới tâm bản đồ: trong vùng này là nhà chọc trời
const MIDTOWN = 9

const DIRS: Record<number, [number, number]> = {
	[E]: [1, 0],
	[N]: [0, -1],
	[W]: [-1, 0],
	[S]: [0, 1],
}

const ZONES: Record<'downtown' | 'midtown' | 'outer', BuildingAsset[]> = {
	downtown: [
		'building-skyscraper-a',
		'building-skyscraper-b',
		'building-skyscraper-c',
		'building-skyscraper-d',
		'building-skyscraper-e',
		'building-m',
		'building-l',
		'building-n',
	],
	midtown: ['building-i', 'building-j', 'building-l', 'building-g', 'building-f', 'building-k'],
	outer: ['building-a', 'building-b', 'building-c', 'building-d', 'building-e', 'building-h'],
}
// nhà 1 ô để lấp chỗ không vừa building lớn của vùng
const FILLERS: Record<keyof typeof ZONES, BuildingAsset[]> = {
	downtown: ['building-f', 'building-g'],
	midtown: ['building-f', 'building-g', 'building-h'],
	outer: ['building-a', 'building-b', 'building-c', 'building-d', 'building-h'],
}

const key = (x: number, z: number) => `${x},${z}`

// Các ô (nguyên) một placement của bản đồ đường chiếm. Đồ vật nhỏ (đèn, cột...) chiếm ô chứa gốc.
function cellsOf(p: Placement): [number, number][] {
	if (!TILES[p.asset]) return [[Math.floor(p.x), Math.floor(p.z)]]
	const f = footprint(p)
	const out: [number, number][] = []
	for (let x = Math.floor(f.x0); x < Math.ceil(f.x0 + f.w - 1e-6); x++)
		for (let z = Math.floor(f.z0); z < Math.ceil(f.z0 + f.d - 1e-6); z++) out.push([x, z])
	return out
}

// Ô có mặt đường ở mặt đất (để building quay mặt ra) và ô đã bị chiếm bởi bất cứ thứ gì.
export const ROAD_CELLS = new Set(
	ROAD_MAP.filter((p) => TILES[p.asset] && !(p.y ?? 0)).flatMap((p) =>
		cellsOf(p).map((c) => key(...c))
	)
)
export const BLOCKED_CELLS = new Set(ROAD_MAP.flatMap((p) => cellsOf(p).map((c) => key(...c))))

// Khu trống "đủ lớn": vùng ô trống liền nhau bên trong vành đai, đủ diện tích và chứa được ô 2 x 2.
function usableCells() {
	const free = (x: number, z: number) =>
		x >= 3 && z >= 3 && x < GRID - 3 && z < GRID - 3 && !BLOCKED_CELLS.has(key(x, z))
	const region = new Map<string, number>()
	const usable = new Set<string>()
	let id = 0
	for (let z = 0; z < GRID; z++)
		for (let x = 0; x < GRID; x++) {
			if (!free(x, z) || region.has(key(x, z))) continue
			const cells: [number, number][] = []
			const stack: [number, number][] = [[x, z]]
			region.set(key(x, z), id)
			while (stack.length) {
				const [cx, cz] = stack.pop()!
				cells.push([cx, cz])
				for (const [dx, dz] of Object.values(DIRS)) {
					const [nx, nz] = [cx + dx, cz + dz]
					if (free(nx, nz) && !region.has(key(nx, nz))) {
						region.set(key(nx, nz), id)
						stack.push([nx, nz])
					}
				}
			}
			const inRegion = (cx: number, cz: number) => region.get(key(cx, cz)) === id
			const hasSquare = cells.some(
				([cx, cz]) => inRegion(cx + 1, cz) && inRegion(cx, cz + 1) && inRegion(cx + 1, cz + 1)
			)
			if (cells.length >= MIN_AREA && hasSquare) for (const c of cells) usable.add(key(...c))
			id++
		}
	return usable
}

export const USABLE_CELLS = usableCells()

const roadAhead = (x: number, z: number, dir: number) => {
	const [dx, dz] = DIRS[dir]
	return ROAD_CELLS.has(key(x + dx, z + dz))
}

function zoneOf(x: number, z: number): keyof typeof ZONES {
	const d = Math.max(Math.abs(x - GRID / 2), Math.abs(z - GRID / 2))
	return d <= DOWNTOWN ? 'downtown' : d <= MIDTOWN ? 'midtown' : 'outer'
}

function generate(): BuildingPlacement[] {
	const rng = createRandom(SEED)
	const shuffle = <T>(list: T[]) => {
		const out = [...list]
		for (let i = out.length - 1; i > 0; i--) {
			const j = Math.floor(rng() * (i + 1))
			;[out[i], out[j]] = [out[j], out[i]]
		}
		return out
	}

	const claimed = new Set<string>()
	const result: BuildingPlacement[] = []
	// ô mặt tiền: ô trống dùng được có đường ngay bên cạnh
	const frontage = [...USABLE_CELLS]
		.map((k) => k.split(',').map(Number) as [number, number])
		.filter(([x, z]) => [E, N, W, S].some((d) => roadAhead(x, z, d)))

	for (const [cx, cz] of shuffle(frontage)) {
		if (claimed.has(key(cx, cz)) || rng() < SKIP) continue
		const zone = zoneOf(cx + 0.5, cz + 0.5)
		const candidates = [...shuffle(ZONES[zone]), ...shuffle(FILLERS[zone])]
		place: for (const front of shuffle([E, N, W, S].filter((d) => roadAhead(cx, cz, d)))) {
			// mặt tiền ở rot 0 quay về Nam -> xoay k lần để quay ra đường
			const k = (front - S + 4) % 4
			const [ax, az] = rotate(1, 0, k).map(Math.round) // dọc mặt tiền
			const [ix, iz] = rotate(0, -1, k).map(Math.round) // vào sâu trong khu
			for (const asset of candidates) {
				const [w, d] = buildingCells(asset)
				for (const offset of shuffle([...Array(w).keys()])) {
					const cells: [number, number][] = []
					const frontRow: [number, number][] = []
					for (let i = -offset; i < w - offset; i++)
						for (let j = 0; j < d; j++) {
							const cell: [number, number] = [cx + ax * i + ix * j, cz + az * i + iz * j]
							cells.push(cell)
							if (j === 0) frontRow.push(cell)
						}
					const fits =
						cells.every(([x, z]) => USABLE_CELLS.has(key(x, z)) && !claimed.has(key(x, z))) &&
						frontRow.every(([x, z]) => roadAhead(x, z, front))
					if (!fits) continue
					for (const [x, z] of cells) claimed.add(key(x, z))
					const x = cells.reduce((s, c) => s + c[0] + 0.5, 0) / cells.length
					const z = cells.reduce((s, c) => s + c[1] + 0.5, 0) / cells.length
					result.push({ asset, x, z, rot: k })
					break place
				}
			}
		}
	}
	return result
}

export const BUILDING_MAP: BuildingPlacement[] = generate()

// Các ô một building chiếm và hướng mặt tiền (dùng cho test và debug).
export function buildingFootprint(b: BuildingPlacement) {
	const [w, d] = buildingCells(b.asset)
	const [fw, fd] = b.rot % 2 ? [d, w] : [w, d]
	const x0 = Math.round(b.x - fw / 2)
	const z0 = Math.round(b.z - fd / 2)
	const cells: [number, number][] = []
	for (let x = x0; x < x0 + fw; x++) for (let z = z0; z < z0 + fd; z++) cells.push([x, z])
	return { cells, front: (S + b.rot) % 4, x0, z0, w: fw, d: fd }
}
