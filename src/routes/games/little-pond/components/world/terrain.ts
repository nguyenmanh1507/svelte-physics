// Hình dạng ao và địa hình xung quanh (mét). Ao sâu nhất ~0.55 m ở giữa, bờ cao GROUND.

export const GROUND = 0.06

export const smooth = (a: number, b: number, x: number) => {
	const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
	return t * t * (3 - 2 * t)
}

// Bán kính mép ao theo góc, lượn bằng vài sóng sin
export function pondR(th: number) {
	return (
		2.9 +
		0.45 * Math.sin(2 * th + 0.6) +
		0.3 * Math.sin(3 * th + 2.1) +
		0.15 * Math.sin(5 * th + 1.3)
	)
}

export function hash2(x: number, z: number) {
	const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
	return s - Math.floor(s)
}

export function vnoise(x: number, z: number) {
	const ix = Math.floor(x),
		iz = Math.floor(z)
	let fx = x - ix,
		fz = z - iz
	fx = fx * fx * (3 - 2 * fx)
	fz = fz * fz * (3 - 2 * fz)
	const a = hash2(ix, iz),
		b = hash2(ix + 1, iz),
		c = hash2(ix, iz + 1),
		d = hash2(ix + 1, iz + 1)
	return a + (b - a) * fx + (c + (d - c) * fx - (a + (b - a) * fx)) * fz
}

// 0 ở tâm, 1 ở mép ao
export function pondT(x: number, z: number) {
	return Math.hypot(x, z) / pondR(Math.atan2(z, x))
}

// Độ cao đáy ao / mặt đất; mặt nước nằm ở y = 0
export function bottom(x: number, z: number) {
	const t = pondT(x, z),
		r = Math.hypot(x, z)
	let h = -0.55 + 0.61 * smooth(0.5, 1.12, t)
	h += (vnoise(x * 1.7, z * 1.7) - 0.5) * 0.06 * (1 - smooth(0.9, 1.2, t))
	h += (vnoise(x * 0.6 + 7, z * 0.6) - 0.5) * 0.1 * smooth(1.1, 1.4, t) * (1 - smooth(5.0, 6.2, r))
	return h
}

export const depthAt = (x: number, z: number) => -bottom(x, z)

// Điểm ngẫu nhiên trong ao có độ sâu > minDepth (không tìm được thì trả về tâm, chỗ sâu nhất)
export function randomInPond(minDepth: number, rand: () => number = Math.random) {
	for (let i = 0; i < 1000; i++) {
		const x = (rand() - 0.5) * 5,
			z = (rand() - 0.5) * 5
		if (depthAt(x, z) > minDepth) return { x, z }
	}
	return { x: 0, z: 0 }
}
