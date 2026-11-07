// Phương trình sóng 2D trên CPU, tốc độ c = √(g·d) đổi theo độ sâu (Bridson §12.2),
// nên gợn sóng chậm lại khi tới gần bờ. Lưới phủ hình vuông SIZE × SIZE quanh gốc toạ độ.

export const SIM_N = 128
export const SIM_SIZE = 8
export const SIM_DX = SIM_SIZE / SIM_N
export const SIM_X0 = -SIM_SIZE / 2
// d hiệu dụng = DEPTH_SCALE · độ sâu, để gợn sóng có tốc độ giống ao thật
export const DEPTH_SCALE = 0.18
const DAMPING = 0.45 // 1/s
const MIN_DEPTH = 0.015 // ô nông hơn coi như bờ

export const waveSpeed = (depth: number) => Math.sqrt(9.81 * Math.max(depth, 0) * DEPTH_SCALE)

export type WaveSim = ReturnType<typeof createWaveSim>

export function createWaveSim(depthAt: (x: number, z: number) => number) {
	const N = SIM_N
	const height = new Float32Array(N * N)
	const velocity = new Float32Array(N * N)
	const c2 = new Float32Array(N * N)
	const mask = new Uint8Array(N * N)
	const lap = new Float32Array(N * N)
	let cMax = 0

	for (let k = 0; k < N; k++)
		for (let i = 0; i < N; i++) {
			const x = SIM_X0 + (i + 0.5) * SIM_DX,
				z = SIM_X0 + (k + 0.5) * SIM_DX
			const depth = depthAt(x, z),
				id = k * N + i
			mask[id] = depth > MIN_DEPTH ? 1 : 0
			c2[id] = waveSpeed(depth) ** 2
			cMax = Math.max(cMax, Math.sqrt(c2[id]))
		}

	function substep(dt: number) {
		const inv = 1 / (SIM_DX * SIM_DX),
			damp = Math.exp(-DAMPING * dt)
		for (let k = 1; k < N - 1; k++)
			for (let i = 1; i < N - 1; i++) {
				const id = k * N + i
				if (!mask[id]) {
					lap[id] = 0
					continue
				}
				// bờ phản xạ: ô hàng xóm là bờ thì lấy chính ô này (đạo hàm pháp tuyến = 0)
				const hc = height[id]
				const l = mask[id - 1] ? height[id - 1] : hc,
					r = mask[id + 1] ? height[id + 1] : hc
				const d = mask[id - N] ? height[id - N] : hc,
					u = mask[id + N] ? height[id + N] : hc
				lap[id] = (l + r + d + u - 4 * hc) * inv
			}
		for (let id = 0; id < N * N; id++) {
			if (!mask[id]) {
				height[id] = 0
				velocity[id] = 0
				continue
			}
			velocity[id] = (velocity[id] + dt * c2[id] * lap[id]) * damp
			height[id] += dt * velocity[id]
		}
	}

	return {
		height,
		mask,
		cMax,

		// Chia nhỏ bước để giữ điều kiện CFL (c·dt/dx < 0.5); trả về số bước con
		step(dt: number) {
			const steps = Math.max(1, Math.ceil(dt / ((0.5 * SIM_DX) / cMax)))
			for (let s = 0; s < steps; s++) substep(dt / steps)
			return steps
		},

		// Thả một giọt hình cos tại (x, z): amp < 0 là ấn mặt nước xuống
		addDrop(x: number, z: number, amp: number, radius: number) {
			const gi = (x - SIM_X0) / SIM_DX - 0.5,
				gk = (z - SIM_X0) / SIM_DX - 0.5
			const R = Math.ceil((radius * 2) / SIM_DX)
			for (let k = Math.max(1, Math.floor(gk - R)); k <= Math.min(N - 2, gk + R); k++)
				for (let i = Math.max(1, Math.floor(gi - R)); i <= Math.min(N - 2, gi + R); i++) {
					const id = k * N + i
					if (!mask[id]) continue
					const r = (Math.hypot(i - gi, k - gk) * SIM_DX) / radius
					if (r >= 1) continue
					height[id] += amp * (0.5 + 0.5 * Math.cos(Math.PI * r))
				}
		},

		// Độ cao mặt nước nội suy song tuyến
		sample(x: number, z: number) {
			let fx = (x - SIM_X0) / SIM_DX - 0.5,
				fz = (z - SIM_X0) / SIM_DX - 0.5
			fx = Math.min(Math.max(fx, 0), N - 1.001)
			fz = Math.min(Math.max(fz, 0), N - 1.001)
			const i = fx | 0,
				k = fz | 0,
				tx = fx - i,
				tz = fz - k,
				o = k * N + i
			return (
				(height[o] * (1 - tx) + height[o + 1] * tx) * (1 - tz) +
				(height[o + N] * (1 - tx) + height[o + N + 1] * tx) * tz
			)
		},
	}
}
