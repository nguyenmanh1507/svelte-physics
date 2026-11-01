import * as THREE from 'three'

const MAX_PITCH = Math.PI / 2 - 0.01
const MIN_FOV = 15
const MAX_FOV = 90
const MIN_ALTITUDE = 1.7 // m, tầm mắt người
const FAST = 15 // hệ số tốc độ khi giữ Shift

// Camera bay tự do (đơn vị mét):
//   kéo chuột: nhìn quanh · W A S D: tiến / lùi / trái / phải theo hướng nhìn
//   E / Space: lên · Q / Ctrl: xuống · Shift: bay nhanh · cuộn: zoom bằng FOV
// Phím chỉ nhận khi element đang focus (click vào canvas), không tranh phím với bảng điều khiển.
export class FlyControls {
	yaw = 0
	pitch = 0.35
	speed = 60 // m/s
	readonly keys = new Set<string>()

	#camera: THREE.PerspectiveCamera
	#element: HTMLElement
	#dragging = false
	#lastX = 0
	#lastY = 0
	#forward = new THREE.Vector3()
	#right = new THREE.Vector3()

	constructor(camera: THREE.PerspectiveCamera, element: HTMLElement) {
		this.#camera = camera
		this.#element = element
		camera.rotation.order = 'YXZ'
		if (element.tabIndex < 0) element.tabIndex = 0
		element.addEventListener('pointerdown', this.#onDown)
		element.addEventListener('pointermove', this.#onMove)
		element.addEventListener('pointerup', this.#onUp)
		element.addEventListener('pointercancel', this.#onUp)
		element.addEventListener('wheel', this.#onWheel, { passive: false })
		element.addEventListener('keydown', this.#onKeyDown)
		element.addEventListener('keyup', this.#onKeyUp)
		element.addEventListener('blur', this.#onBlur)
	}

	update(delta: number) {
		const cam = this.#camera
		cam.rotation.set(this.pitch, this.yaw, 0)

		const k = this.keys
		const v = this.speed * (k.has('ShiftLeft') || k.has('ShiftRight') ? FAST : 1) * delta
		this.#forward.set(0, 0, -1).applyQuaternion(cam.quaternion)
		this.#right.set(1, 0, 0).applyQuaternion(cam.quaternion)

		if (k.has('KeyW')) cam.position.addScaledVector(this.#forward, v)
		if (k.has('KeyS')) cam.position.addScaledVector(this.#forward, -v)
		if (k.has('KeyD')) cam.position.addScaledVector(this.#right, v)
		if (k.has('KeyA')) cam.position.addScaledVector(this.#right, -v)
		if (k.has('KeyE') || k.has('Space')) cam.position.y += v
		if (k.has('KeyQ') || k.has('ControlLeft')) cam.position.y -= v
		cam.position.y = Math.max(cam.position.y, MIN_ALTITUDE)

		cam.updateMatrixWorld()
	}

	dispose() {
		const el = this.#element
		el.removeEventListener('pointerdown', this.#onDown)
		el.removeEventListener('pointermove', this.#onMove)
		el.removeEventListener('pointerup', this.#onUp)
		el.removeEventListener('pointercancel', this.#onUp)
		el.removeEventListener('wheel', this.#onWheel)
		el.removeEventListener('keydown', this.#onKeyDown)
		el.removeEventListener('keyup', this.#onKeyUp)
		el.removeEventListener('blur', this.#onBlur)
	}

	#onDown = (e: PointerEvent) => {
		this.#dragging = true
		this.#lastX = e.clientX
		this.#lastY = e.clientY
		this.#element.setPointerCapture(e.pointerId)
		this.#element.focus({ preventScroll: true })
	}

	#onUp = () => {
		this.#dragging = false
	}

	#onMove = (e: PointerEvent) => {
		if (!this.#dragging) return
		// zoom càng sâu thì xoay càng chậm
		const k = (0.0035 * this.#camera.fov) / 60
		this.yaw += (e.clientX - this.#lastX) * k
		this.pitch = THREE.MathUtils.clamp(
			this.pitch + (e.clientY - this.#lastY) * k,
			-MAX_PITCH,
			MAX_PITCH
		)
		this.#lastX = e.clientX
		this.#lastY = e.clientY
	}

	#onWheel = (e: WheelEvent) => {
		e.preventDefault()
		const cam = this.#camera
		cam.fov = Math.min(MAX_FOV, Math.max(MIN_FOV, cam.fov * (1 + Math.sign(e.deltaY) * 0.08)))
		cam.updateProjectionMatrix()
	}

	#onKeyDown = (e: KeyboardEvent) => {
		if (e.code === 'Space') e.preventDefault()
		this.keys.add(e.code)
	}

	#onKeyUp = (e: KeyboardEvent) => {
		this.keys.delete(e.code)
	}

	// mất focus thì không nhận keyup nữa -> thả hết phím để camera không trôi mãi
	#onBlur = () => {
		this.keys.clear()
		this.#dragging = false
	}
}
