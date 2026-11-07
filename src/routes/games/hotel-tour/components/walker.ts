import * as THREE from 'three'
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'
import { moveCircle, walkDirection, type Rect } from './walk'

export const EYE_HEIGHT = 1.62
const RADIUS = 0.3
const WALK_SPEED = 2.2 // m/s
const RUN_SPEED = 4

const FORWARD = ['KeyW', 'ArrowUp']
const BACK = ['KeyS', 'ArrowDown']
const LEFT = ['KeyA', 'ArrowLeft']
const RIGHT = ['KeyD', 'ArrowRight']
const MOVE_KEYS = new Set([...FORWARD, ...BACK, ...LEFT, ...RIGHT])

// Góc nhìn thứ nhất: chuột xoay (pointer lock), W A S D đi, Shift đi nhanh.
export class Walker {
	readonly controls: PointerLockControls
	colliders: Rect[] = []
	#camera: THREE.PerspectiveCamera
	#keys = new Set<string>()
	#euler = new THREE.Euler(0, 0, 0, 'YXZ')

	constructor(camera: THREE.PerspectiveCamera, dom: HTMLElement) {
		this.#camera = camera
		this.controls = new PointerLockControls(camera, dom)
		this.controls.addEventListener('unlock', this.#clearKeys)
		window.addEventListener('keydown', this.#onKeyDown)
		window.addEventListener('keyup', this.#onKeyUp)
		window.addEventListener('blur', this.#clearKeys)
	}

	get locked() {
		return this.controls.isLocked
	}

	place(x: number, y: number, z: number, yaw: number) {
		this.#camera.position.set(x, y, z)
		this.#camera.quaternion.setFromEuler(this.#euler.set(0, yaw, 0, 'YXZ'))
	}

	update(dt: number) {
		const pressed = (codes: string[]) => (codes.some((c) => this.#keys.has(c)) ? 1 : 0)
		const forward = pressed(FORWARD) - pressed(BACK)
		const right = pressed(RIGHT) - pressed(LEFT)
		if (!forward && !right) return

		const yaw = this.#euler.setFromQuaternion(this.#camera.quaternion, 'YXZ').y
		const dir = walkDirection(yaw, forward, right)
		const run = this.#keys.has('ShiftLeft') || this.#keys.has('ShiftRight')
		const step = (run ? RUN_SPEED : WALK_SPEED) * dt
		const p = this.#camera.position
		const next = moveCircle({ x: p.x, z: p.z }, dir.x * step, dir.z * step, RADIUS, this.colliders)
		p.x = next.x
		p.z = next.z
	}

	dispose() {
		this.controls.removeEventListener('unlock', this.#clearKeys)
		window.removeEventListener('keydown', this.#onKeyDown)
		window.removeEventListener('keyup', this.#onKeyUp)
		window.removeEventListener('blur', this.#clearKeys)
		this.controls.dispose()
	}

	#onKeyDown = (e: KeyboardEvent) => {
		if (!this.controls.isLocked) return
		if (MOVE_KEYS.has(e.code)) e.preventDefault()
		this.#keys.add(e.code)
	}

	#onKeyUp = (e: KeyboardEvent) => {
		this.#keys.delete(e.code)
	}

	#clearKeys = () => {
		this.#keys.clear()
	}
}
