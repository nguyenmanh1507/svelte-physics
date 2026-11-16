// Tiện ích input không phụ thuộc DOM: deadzone, expo, làm mượt, và bộ đệm sự kiện
// phát hiện chord / double-tap / hold theo timestamp.
import { clamp, clamp01 } from './math'

/** Deadzone hướng tâm cho cần analog, giữ nguyên hướng */
export function scaledRadial(x: number, y: number, inner: number, outer = 0.98): [number, number] {
	const m = Math.hypot(x, y)
	if (m < inner) return [0, 0]
	const k = clamp01((m - inner) / (outer - inner)) / m
	return [x * k, y * k]
}

export const expo = (x: number, e: number) =>
	Math.sign(x) * ((1 - e) * Math.abs(x) + e * Math.abs(x) ** 3)

/** Lọc thông thấp bậc 1 với hằng số thời gian tau */
export class Smoother {
	v = 0
	update(t: number, dt: number, tau: number) {
		this.v += (t - this.v) * (1 - Math.exp(-dt / Math.max(tau, 1e-4)))
		return this.v
	}
}

/** Biến 2 phím (âm/dương) thành trục analog có tốc độ dâng/hạ riêng */
export class KeyAxis {
	v = 0
	constructor(
		public rise = 4,
		public fall = 7
	) {}
	update(neg: boolean, pos: boolean, dt: number) {
		const t = (pos ? 1 : 0) - (neg ? 1 : 0)
		const r = t === 0 || Math.sign(t) !== Math.sign(this.v) ? this.fall : this.rise
		this.v += clamp(t - this.v, -r * dt, r * dt)
		return this.v
	}
}

export type InputEvent =
	| { type: 'press'; a: string; t: number }
	| { type: 'release'; a: string; t: number; held: number }
	| { type: 'double'; a: string; t: number; gap: number }
	| { type: 'chord'; a: string; t: number; gap: number }

export type ComboEvent = Extract<InputEvent, { type: 'double' | 'chord' }>

export type ChordDef = { name: string; keys: string[] }

export type InputBufferOptions = {
	chordWindow?: number
	doubleWindow?: number
	chords?: ChordDef[]
}

/** Nhận sự kiện có timestamp (giây), phát hiện chord / double-tap / hold */
export class InputBuffer {
	chordWindow: number
	doubleWindow: number
	chords: ChordDef[]
	down = new Map<string, number>()
	lastPress = new Map<string, number>()
	queue: InputEvent[] = []
	/** vài combo gần nhất (mới nhất trước) để hiển thị debug */
	log: ComboEvent[] = []

	constructor(opt: InputBufferOptions = {}) {
		this.chordWindow = opt.chordWindow ?? 0.09
		this.doubleWindow = opt.doubleWindow ?? 0.26
		this.chords = opt.chords ?? []
	}

	press(a: string, t: number) {
		if (this.down.has(a)) return
		this.down.set(a, t)
		const prev = this.lastPress.get(a)
		if (prev !== undefined && t - prev <= this.doubleWindow) {
			this.emit({ type: 'double', a, t, gap: t - prev })
			this.lastPress.delete(a)
		} else this.lastPress.set(a, t)
		this.emit({ type: 'press', a, t })
		for (const ch of this.chords)
			if (ch.keys.includes(a)) {
				const times = ch.keys.map((k) => this.down.get(k))
				if (times.every((x) => x !== undefined)) {
					const spread = Math.max(...times) - Math.min(...times)
					if (spread <= this.chordWindow) this.emit({ type: 'chord', a: ch.name, t, gap: spread })
				}
			}
	}

	release(a: string, t: number) {
		const t0 = this.down.get(a)
		if (t0 === undefined) return
		this.down.delete(a)
		this.emit({ type: 'release', a, t, held: t - t0 })
	}

	isDown(a: string) {
		return this.down.has(a)
	}

	heldFor(a: string, now: number) {
		const t0 = this.down.get(a)
		return t0 === undefined ? 0 : now - t0
	}

	/** nhả mọi phím đang giữ (mất focus, đổi trang…) */
	releaseAll(t: number) {
		for (const a of [...this.down.keys()]) this.release(a, t)
	}

	private emit(e: InputEvent) {
		this.queue.push(e)
		if (e.type === 'double' || e.type === 'chord') {
			this.log.unshift(e)
			this.log.length = Math.min(this.log.length, 6)
		}
	}

	drain() {
		const q = this.queue
		this.queue = []
		return q
	}
}
