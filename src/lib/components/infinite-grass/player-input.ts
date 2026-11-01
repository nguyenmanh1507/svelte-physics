import * as THREE from 'three'

const FORWARD = ['KeyW', 'ArrowUp']
const BACK = ['KeyS', 'ArrowDown']
const LEFT = ['KeyA', 'ArrowLeft']
const RIGHT = ['KeyD', 'ArrowRight']

// Hướng đi trên mặt đất (xz, độ dài 0 hoặc 1) từ phím đang giữ, tương đối với hướng nhìn camera.
// `forward` là hướng nhìn của camera chiếu xuống mặt đất (chưa cần chuẩn hoá).
export function moveDirection(
	keys: ReadonlySet<string>,
	forward: { x: number; z: number },
	target = new THREE.Vector2()
) {
	const has = (codes: string[]) => codes.some((c) => keys.has(c))
	const ahead = Number(has(FORWARD)) - Number(has(BACK))
	const side = Number(has(RIGHT)) - Number(has(LEFT))

	const len = Math.hypot(forward.x, forward.z) || 1
	const fx = forward.x / len
	const fz = forward.z / len
	// bên phải của hướng nhìn: (-fz, fx)
	target.set(fx * ahead - fz * side, fz * ahead + fx * side)
	if (target.lengthSq() > 0) target.normalize()
	return target
}

// Phím của nhân vật. Chỉ nhận khi element đang focus (click vào canvas),
// để gõ phím trên bảng điều khiển không làm nhân vật chạy.
export class PlayerInput {
	readonly keys = new Set<string>()
	#element: HTMLElement

	constructor(element: HTMLElement) {
		this.#element = element
		if (element.tabIndex < 0) element.tabIndex = 0
		element.addEventListener('pointerdown', this.#onDown)
		element.addEventListener('keydown', this.#onKeyDown)
		element.addEventListener('keyup', this.#onKeyUp)
		element.addEventListener('blur', this.#onBlur)
	}

	get running() {
		return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
	}

	dispose() {
		const el = this.#element
		el.removeEventListener('pointerdown', this.#onDown)
		el.removeEventListener('keydown', this.#onKeyDown)
		el.removeEventListener('keyup', this.#onKeyUp)
		el.removeEventListener('blur', this.#onBlur)
	}

	#onDown = () => this.#element.focus({ preventScroll: true })

	#onKeyDown = (e: KeyboardEvent) => {
		if (e.code.startsWith('Arrow')) e.preventDefault()
		this.keys.add(e.code)
	}

	#onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code)

	// mất focus thì không nhận keyup nữa -> thả hết phím để nhân vật không chạy mãi
	#onBlur = () => this.keys.clear()
}
