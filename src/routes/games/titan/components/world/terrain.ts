import { fbm, smooth } from './noise'

/** cao độ mặt chất lỏng; mọi hồ và kênh dùng chung một mực */
export const LIQUID_LEVEL = 0
/** nửa cạnh của mảnh đất (m) */
export const WORLD_HALF = 900
/** nửa cạnh lưới mặt chất lỏng; phải phủ hết mọi chỗ shoreDistance < 0 */
export const LIQUID_HALF = 330
/** điểm nhìn của camera được cách bờ hồ xa nhất chừng này (m) */
export const ROAM_SHORE_MARGIN = 60

// hồ chính (kiểu Ontario Lacus thu nhỏ) và một hồ phụ; sx/sz kéo giãn thành hình bầu dục
const LAKES = [
	{ x: 0, z: 0, r: 95, sx: 1.25, sz: 0.85 },
	{ x: 150, z: -110, r: 38, sx: 1, sz: 1.1 },
]
// kênh do hydrocarbon lỏng khoét, nối hai hồ; hai đầu nằm sâu trong lòng hồ
const CHANNEL = { ax: 150, az: -110, bx: 60, bz: -45, halfWidth: 6 }

function segmentDistance(x: number, z: number) {
	const { ax, az, bx, bz } = CHANNEL
	const dx = bx - ax,
		dz = bz - az
	const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)))
	return Math.hypot(x - ax - dx * t, z - az - dz * t)
}

/**
 * Khoảng cách có dấu tới đường bờ (m): âm = trong lòng hồ/kênh, dương = đất liền.
 * Chỉ là xấp xỉ (bờ bị nhiễu bẻ cong) nhưng liên tục và đổi dấu đúng tại bờ.
 */
export function shoreDistance(x: number, z: number) {
	let lake = Infinity
	for (const l of LAKES) lake = Math.min(lake, Math.hypot((x - l.x) / l.sx, (z - l.z) / l.sz) - l.r)
	// bờ hồ khúc khuỷu: vịnh lớn + răng cưa nhỏ
	lake += (fbm(x * 0.011 + 3.1, z * 0.011 - 7.4, 3) - 0.5) * 52
	lake += (fbm(x * 0.05, z * 0.05, 2) - 0.5) * 10

	// kênh uốn khúc nhẹ; nhiễu nhỏ hơn bề rộng để kênh không bị đứt
	const channel =
		segmentDistance(x + 10 * Math.sin(z * 0.05), z + 10 * Math.sin(x * 0.045)) -
		CHANNEL.halfWidth +
		(fbm(x * 0.07 + 9, z * 0.07, 2) - 0.5) * 5

	return Math.min(lake, channel)
}

/** 0..1: vùng cồn cát hydrocarbon sẫm màu, tránh xa bờ hồ */
export function duneMask(x: number, z: number, shore = shoreDistance(x, z)) {
	return smooth(0.5, 0.64, fbm(x * 0.003 + 40, z * 0.003 + 17, 2)) * smooth(50, 140, shore)
}

function heightFromShore(x: number, z: number, shore: number) {
	if (shore < 0) {
		// lòng hồ: dốc thoải rồi phẳng dần ở ~7.5 m, thêm gợn đáy khi đã đủ sâu
		const depth = 7.5 * (1 - Math.exp(shore / 45))
		const bumps = (fbm(x * 0.06, z * 0.06, 2) - 0.5) * 1.2 * smooth(0, 25, -shore)
		return LIQUID_LEVEL - depth + bumps
	}
	// bãi ven hồ rất thoải, xa dần thì thành đồi băng
	const beach = 0.05 * shore
	const hills =
		3 +
		26 * Math.pow(fbm(x * 0.0045 + 11, z * 0.0045 + 5, 5), 1.6) +
		// vành cao nguyên ở xa che mép địa hình
		30 * smooth(350, 850, Math.hypot(x, z))
	let h = beach + (hills - beach) * smooth(6, 95, shore)

	// cồn cát dạng dải dài song song (như sa mạc Namib), bị nhiễu bẻ cong nhẹ
	const phase = ((x * 0.82 + z * 0.57) * Math.PI) / 55 + 3 * fbm(x * 0.01, z * 0.01, 2)
	h += 4.5 * Math.pow(0.5 + 0.5 * Math.sin(phase), 1.5) * duneMask(x, z, shore)

	h += (fbm(x * 0.09, z * 0.09, 3) - 0.5) * 0.8 * smooth(2, 30, shore)
	return LIQUID_LEVEL + h
}

/** cao độ mặt đất (kể cả đáy hồ) */
export function groundH(x: number, z: number, shore = shoreDistance(x, z)) {
	return heightFromShore(x, z, shore)
}

/** camera chỉ được nhìn vào những điểm trên hồ hoặc gần bờ, để khung hình luôn có hồ */
export function inRoamRange(x: number, z: number) {
	return shoreDistance(x, z) < ROAM_SHORE_MARGIN
}
