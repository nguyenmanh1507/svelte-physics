import { describe, expect, it } from 'vitest'
import { depthAt } from './terrain'
import { createWaveSim, SIM_DX, waveSpeed } from './wave-sim'

const maxAbs = (a: Float32Array) => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0)

describe('createWaveSim', () => {
	it('giọt nước ấn mặt nước xuống tại chỗ thả', () => {
		const sim = createWaveSim(depthAt)
		sim.addDrop(0, 0, -0.01, 0.12)
		expect(sim.sample(0, 0)).toBeLessThan(-0.005)
	})

	it('ô trên bờ luôn phẳng', () => {
		const sim = createWaveSim(depthAt)
		sim.addDrop(0, 0, -0.05, 0.3)
		for (let i = 0; i < 300; i++) sim.step(1 / 60)
		sim.height.forEach((h, id) => {
			if (!sim.mask[id]) expect(h).toBe(0)
		})
	})

	it('gợn sóng lan ra rồi tắt dần, không nổ số', () => {
		const sim = createWaveSim(depthAt)
		sim.addDrop(0.5, -0.3, -0.05, 0.16)
		const start = maxAbs(sim.height)
		for (let i = 0; i < 60 * 8; i++) sim.step(1 / 30)
		const end = maxAbs(sim.height)
		expect(Number.isFinite(end)).toBe(true)
		expect(end).toBeLessThan(start * 0.2)
	})

	it('chia nhỏ bước khi dt lớn để giữ ổn định', () => {
		const sim = createWaveSim(depthAt)
		const steps = sim.step(1 / 30)
		expect(steps).toBeGreaterThanOrEqual(Math.ceil(1 / 30 / ((0.5 * SIM_DX) / sim.cMax)))
	})

	it('sóng chậm hơn ở chỗ nông', () => {
		expect(waveSpeed(0.08)).toBeLessThan(waveSpeed(0.55))
		expect(waveSpeed(-1)).toBe(0)
	})
})
