// =====================================================================
//  INPUT ADAPTER (DOM) — bàn phím, chuột (pointer lock), lăn chuột, gamepad, cần ảo cảm ứng.
//  Chỉ biến thiết bị thành tên hành động + trục analog; logic điều khiển nằm ở lõi.
// =====================================================================
import {
	BOOST_BRAKE_CHORD,
	InputBuffer,
	KeyAxis,
	clamp,
	expo,
	scaledRadial,
	type AircraftConfig,
	type FlightAction,
	type InputEvent,
} from '../core'

/** Lệnh cấp controller (không phải lệnh bay) */
export type FlightCommand =
	{ type: 'cycleMode' } | { type: 'respawn' } | { type: 'throttle'; delta: number }

export const DEFAULT_KEYMAP: Record<string, FlightAction> = {
	KeyW: 'pitchDown',
	KeyS: 'pitchUp',
	ArrowUp: 'pitchDown',
	ArrowDown: 'pitchUp',
	KeyA: 'rollL',
	KeyD: 'rollR',
	ArrowLeft: 'rollL',
	ArrowRight: 'rollR',
	KeyQ: 'yawL',
	KeyE: 'yawR',
	ShiftLeft: 'boost',
	ShiftRight: 'boost',
	Space: 'brake',
	KeyV: 'arm',
	KeyX: 'splitS',
	KeyC: 'immelmann',
}

export const DEFAULT_COMMAND_KEYS: Record<string, FlightCommand> = {
	KeyM: { type: 'cycleMode' },
	KeyR: { type: 'respawn' },
	BracketRight: { type: 'throttle', delta: 0.1 },
	BracketLeft: { type: 'throttle', delta: -0.1 },
}

/** Nút gamepad (Standard Gamepad layout) → hành động */
const PAD_ACTIONS: Record<number, FlightAction> = {
	7: 'boost', // RT
	6: 'brake', // LT
	4: 'yawL', // LB
	5: 'yawR', // RB
	0: 'arm', // A
	2: 'splitS', // X
	3: 'immelmann', // Y
}
const PAD_COMMANDS: Record<number, FlightCommand> = {
	8: { type: 'cycleMode' }, // Back
	9: { type: 'respawn' }, // Start
}

/** Phím không được preventDefault khi đang gõ trong ô nhập */
const isTyping = (e: Event) => {
	const t = e.target as HTMLElement | null
	return !!t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable)
}

/** px; một sự kiện mousemove lớn hơn thế này coi là nhiễu */
const MAX_MOUSE_STEP = 250

const nowS = () => performance.now() / 1000
// thời điểm OS tạo sự kiện → đo chord/double-tap chính xác dù frame chậm
const eventTime = (e: Event) => (e.timeStamp > 0 ? e.timeStamp / 1000 : nowS())

export type FlightInputOptions = {
	/** phần tử nhận lăn chuột (thường là canvas) */
	wheelTarget?: HTMLElement
	keymap?: Record<string, FlightAction>
	commandKeys?: Record<string, FlightCommand>
	onCommand?: (cmd: FlightCommand) => void
	/** bỏ qua chuột khi dùng cảm ứng */
	touch?: boolean
}

export type SampledAxes = {
	pitch: number
	roll: number
	yaw: number
	boost: boolean
	brake: boolean
}

export class FlightInput {
	readonly buffer = new InputBuffer({
		chords: [{ name: BOOST_BRAKE_CHORD, keys: ['boost', 'brake'] }],
		chordWindow: 0.12,
	})
	onCommand: ((cmd: FlightCommand) => void) | undefined

	private keymap: Record<string, FlightAction>
	private commandKeys: Record<string, FlightCommand>
	private keys = new Set<string>()
	private mouseDX = 0
	private mouseDY = 0
	private stick = { x: 0, y: 0 }
	private padPrev: boolean[] = []
	private kPitch = new KeyAxis(4, 7)
	private kRoll = new KeyAxis(5, 8)
	private kYaw = new KeyAxis(3, 6)
	private touch: boolean
	private wheelTarget: HTMLElement | undefined
	private ac = new AbortController()
	private mouseOn = false
	private skipNextMove = true

	/** nhận chuyển động chuột (bật khi đang bay) */
	get mouseEnabled() {
		return this.mouseOn
	}
	set mouseEnabled(on: boolean) {
		this.mouseOn = on
		this.skipNextMove = true
		this.mouseDX = this.mouseDY = 0
	}

	constructor(opts: FlightInputOptions = {}) {
		this.keymap = opts.keymap ?? DEFAULT_KEYMAP
		this.commandKeys = opts.commandKeys ?? DEFAULT_COMMAND_KEYS
		this.onCommand = opts.onCommand
		this.touch = opts.touch ?? false
		this.wheelTarget = opts.wheelTarget
		const signal = this.ac.signal
		addEventListener('keydown', this.onKeyDown, { signal })
		addEventListener('keyup', this.onKeyUp, { signal })
		addEventListener('blur', this.onBlur, { signal })
		addEventListener('mousemove', this.onMouseMove, { signal })
		document.addEventListener('pointerlockchange', this.onPointerLockChange, { signal })
		this.wheelTarget?.addEventListener('wheel', this.onWheel, { signal, passive: true })
	}

	dispose() {
		this.ac.abort()
		this.keys.clear()
	}

	// ---- API cho nút / cần ảo trên màn hình cảm ứng
	press(a: FlightAction) {
		this.buffer.press(a, nowS())
	}
	release(a: FlightAction) {
		this.buffer.release(a, nowS())
	}
	/** giả lập double-tap (nút ROLL cảm ứng → barrel roll) */
	doubleTap(a: FlightAction) {
		const t = nowS()
		this.buffer.press(a, t)
		this.buffer.release(a, t)
		this.buffer.press(a, t + 0.01)
	}
	/** cần ảo, toạ độ chuẩn hoá trong đường tròn đơn vị (y dương = kéo về phía người) */
	setStick(x: number, y: number) {
		this.stick.x = x
		this.stick.y = y
	}

	/** lấy và reset chuyển động chuột tích luỹ (pixel) */
	consumeMouse(): [number, number] {
		const d: [number, number] = [this.mouseDX, this.mouseDY]
		this.mouseDX = this.mouseDY = 0
		return d
	}

	drain(): InputEvent[] {
		return this.buffer.drain()
	}

	/** Gộp mọi thiết bị thành trục analog; gọi mỗi frame */
	sample(dt: number, cfg: AircraftConfig['input']): SampledAxes {
		const pad = this.pollGamepad(nowS(), cfg)
		const held = (a: FlightAction) => {
			for (const k of this.keys) if (this.keymap[k] === a) return true
			return false
		}
		let pitch = this.kPitch.update(held('pitchDown'), held('pitchUp'), dt)
		let roll = this.kRoll.update(held('rollL'), held('rollR'), dt)
		let yaw = this.kYaw.update(held('yawL'), held('yawR'), dt)
		if (pad) {
			pitch += pad.pitch
			roll += pad.roll
		}
		if (this.touch) {
			const [x, y] = scaledRadial(this.stick.x, this.stick.y, 0.12)
			pitch += expo(y, 0.4)
			roll += expo(x, 0.4)
		}
		// yaw từ nút giữ không phải bàn phím (LB/RB gamepad)
		if (this.buffer.isDown('yawL') && !held('yawL')) yaw -= 1
		if (this.buffer.isDown('yawR') && !held('yawR')) yaw += 1
		return {
			pitch: clamp(pitch, -1, 1),
			roll: clamp(roll, -1, 1),
			yaw: clamp(yaw, -1, 1),
			boost: this.buffer.isDown('boost'),
			brake: this.buffer.isDown('brake'),
		}
	}

	private pollGamepad(t: number, cfg: AircraftConfig['input']) {
		const pads = navigator.getGamepads ? navigator.getGamepads() : []
		const p = [...pads].find((x) => x && x.connected)
		if (!p) return null
		const btn = (i: number) => (p.buttons[i] ? p.buttons[i].value > 0.5 : false)
		for (const [i, a] of Object.entries(PAD_ACTIONS)) {
			const idx = +i
			const d = btn(idx)
			if (d && !this.padPrev[idx]) this.buffer.press(a, t)
			if (!d && this.padPrev[idx]) this.buffer.release(a, t)
			this.padPrev[idx] = d
		}
		for (const [i, cmd] of Object.entries(PAD_COMMANDS)) {
			const idx = +i
			const d = btn(idx)
			if (d && !this.padPrev[idx]) this.onCommand?.(cmd)
			this.padPrev[idx] = d
		}
		const [x, y] = scaledRadial(p.axes[0] || 0, p.axes[1] || 0, cfg.deadzone)
		return { roll: expo(x, cfg.expo), pitch: expo(y, cfg.expo) }
	}

	private onKeyDown = (e: KeyboardEvent) => {
		if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return
		const a = this.keymap[e.code]
		const cmd = this.commandKeys[e.code]
		// Space/mũi tên không được cuộn trang hay bấm nút đang focus
		if (a && (e.code === 'Space' || e.code.startsWith('Arrow'))) e.preventDefault()
		if (e.repeat) return
		this.keys.add(e.code)
		if (a) this.buffer.press(a, eventTime(e))
		if (cmd) this.onCommand?.(cmd)
	}

	private onKeyUp = (e: KeyboardEvent) => {
		this.keys.delete(e.code)
		const a = this.keymap[e.code]
		if (a) this.buffer.release(a, eventTime(e))
	}

	private onBlur = () => {
		this.buffer.releaseAll(nowS())
		this.keys.clear()
	}

	private onMouseMove = (e: MouseEvent) => {
		if (!this.mouseOn || this.touch) return
		// Chrome hay bắn một mousemove với movementX/Y rất lớn ngay sau khi khoá/nhả chuột
		// hoặc khi DOM dưới con trỏ đổi → bỏ sự kiện đầu tiên và mọi bước nhảy bất thường
		if (this.skipNextMove) {
			this.skipNextMove = false
			return
		}
		if (Math.abs(e.movementX) > MAX_MOUSE_STEP || Math.abs(e.movementY) > MAX_MOUSE_STEP) return
		this.mouseDX += e.movementX
		this.mouseDY += e.movementY
	}

	private onPointerLockChange = () => {
		this.skipNextMove = true
	}

	private onWheel = (e: WheelEvent) => {
		this.onCommand?.({ type: 'throttle', delta: -Math.sign(e.deltaY) * 0.05 })
	}
}
