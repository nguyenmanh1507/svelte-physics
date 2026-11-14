// Keyboard and pointer input.
import type { SubInput } from './submarine'

const axis = (keys: ReadonlySet<string>, plus: string, minus: string) =>
	(keys.has(plus) ? 1 : 0) - (keys.has(minus) ? 1 : 0)

/** W/S thrust, A/D turn left/right, E/Q rise/dive */
export function inputFromKeys(keys: ReadonlySet<string>): SubInput {
	return {
		thrust: axis(keys, 'KeyW', 'KeyS'),
		turn: axis(keys, 'KeyA', 'KeyD'),
		rise: axis(keys, 'KeyE', 'KeyQ'),
	}
}

export interface Input {
	/** `KeyboardEvent.code` of every key currently held */
	keys: Set<string>
	/** camera orbit around the submarine, changed by dragging on the canvas */
	orbit: { yaw: number; pitch: number }
	dragging: boolean
	dispose(): void
}

const ORBIT_SENSITIVITY = 0.003
const PITCH_MIN = -0.3
const PITCH_MAX = 1.2

export function attachInput(target: EventTarget, canvas: EventTarget): Input {
	const input: Input = {
		keys: new Set(),
		orbit: { yaw: 0, pitch: 0 },
		dragging: false,
		dispose,
	}
	const listeners: [EventTarget, string, (e: Event) => void][] = [
		[target, 'keydown', (e) => input.keys.add((e as KeyboardEvent).code)],
		[target, 'keyup', (e) => input.keys.delete((e as KeyboardEvent).code)],
		// a key released while the window is unfocused never sends keyup
		[target, 'blur', () => (input.keys.clear(), (input.dragging = false))],
		[
			canvas,
			'pointerdown',
			(e) => {
				const p = e as PointerEvent
				input.dragging = true
				;(p.target as Element | null)?.setPointerCapture?.(p.pointerId)
			},
		],
		[canvas, 'pointerup', () => (input.dragging = false)],
		[canvas, 'pointercancel', () => (input.dragging = false)],
		[
			canvas,
			'pointermove',
			(e) => {
				if (!input.dragging) return
				const p = e as PointerEvent
				input.orbit.yaw -= p.movementX * ORBIT_SENSITIVITY
				input.orbit.pitch = Math.min(
					PITCH_MAX,
					Math.max(PITCH_MIN, input.orbit.pitch + p.movementY * ORBIT_SENSITIVITY)
				)
			},
		],
	]
	for (const [t, type, fn] of listeners) t.addEventListener(type, fn)
	function dispose() {
		for (const [t, type, fn] of listeners) t.removeEventListener(type, fn)
		input.keys.clear()
	}
	return input
}
