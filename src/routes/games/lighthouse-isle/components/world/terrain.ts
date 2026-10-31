export const HALF = 50 // box is 100 x 100
export const BASE_Y = -21

export const smooth = (a: number, b: number, x: number) => {
	const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
	return t * t * (3 - 2 * t)
}

// Sea ground
export const floorH = (x: number, z: number) => {
	const r = Math.hypot(x, z)
	// đáy gợn nhẹ quanh -11.5
	let y =
		-11.5 +
		1.4 * Math.sin(x * 0.08 + 0.6) * Math.cos(z * 0.07) +
		0.6 * Math.sin(x * 0.21 + z * 0.17)
	// gò đảo ở giữa: cao ~4 ở tâm, bờ ở r ≈ 8
	y += 15.5 * Math.exp(-Math.pow(r / 14, 2))
	// vành rạn san hô quanh đảo (tạo vùng nước nông dễ nhìn xuyên)
	y +=
		4.2 * Math.exp(-Math.pow((r - 21) / 5.5, 2)) * (0.6 + 0.4 * Math.sin(Math.atan2(z, x) * 3 + 1))
	// một bãi cát nông, chỗ đặt sao biển
	y += 7.5 * Math.exp(-(Math.pow((x - 27) / 9, 2) + Math.pow((z + 22) / 7, 2)))
	// sâu dần về phía thành hộp
	y -= 2.2 * smooth(36, 50, Math.max(Math.abs(x), Math.abs(z)))
	return y
}
