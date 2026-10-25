// Building trong Kenney "City Kit - Commercial" (bản GLB). Cùng đơn vị với kit Roads: 1 ô = 1.
// Gốc model ở tâm đáy, mặt tiền quay về +Z (phía Nam) khi rot = 0 – mái hiên detail-* gắn ở +Z.
// Kích thước [rộng theo X, sâu theo Z] đo từ bounding box của chính các file GLB.
export const BUILDING_SIZES = {
	'building-a': [0.88, 0.94],
	'building-b': [0.97, 0.94],
	'building-c': [0.88, 1.09],
	'building-d': [0.84, 0.9],
	'building-e': [1.64, 1.01],
	'building-f': [0.84, 1.03],
	'building-g': [0.97, 0.92],
	'building-h': [0.88, 1.01],
	'building-i': [1.24, 1.3],
	'building-j': [2.08, 1.34],
	'building-k': [2.08, 0.94],
	'building-l': [1.37, 1.4],
	'building-m': [1.24, 1.24],
	'building-n': [2.32, 1.82],
	'building-skyscraper-a': [1.36, 1.36],
	'building-skyscraper-b': [1.36, 1.36],
	'building-skyscraper-c': [1.28, 1.39],
	'building-skyscraper-d': [1.28, 1.39],
	'building-skyscraper-e': [1.29, 1.24],
} as const satisfies Record<string, readonly [number, number]>

export type BuildingAsset = keyof typeof BUILDING_SIZES

export const BUILDING_ASSETS = Object.keys(BUILDING_SIZES) as BuildingAsset[]

export const BUILDING_DIR = '/3d-models/City Kit - Commercial/Models/GLB format'

export const buildingUrl = (name: BuildingAsset) => encodeURI(`${BUILDING_DIR}/${name}.glb`)

// Số ô building chiếm: [dọc mặt tiền, chiều sâu]. Cho lấn tối đa 0.1 ô (vd. building-j rộng 2.08 -> 2 ô).
export function buildingCells(name: BuildingAsset): [number, number] {
	const [w, d] = BUILDING_SIZES[name]
	return [Math.max(1, Math.ceil(w - 0.1)), Math.max(1, Math.ceil(d - 0.1))]
}
