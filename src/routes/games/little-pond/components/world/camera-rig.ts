import * as THREE from 'three'
import { depthAt } from './terrain'

// Camera quỹ đạo quanh ao + input: chạm mặt nước = rắc thức ăn, kéo trên mặt nước = khuấy,
// kéo trên bờ / chuột phải = xoay, cuộn / chụm hai ngón = zoom.

const MIN_DIST = 2.2
const MAX_DIST = 12
const TAP_SLOP = 6 // px

export interface PondInputHandlers {
	onTap: (x: number, z: number) => void
	onStir: (x: number, z: number) => void
}

export function createCameraRig(camera: THREE.PerspectiveCamera) {
	const rig = { yaw: 0.6, pitch: 0.62, dist: 6.4, target: new THREE.Vector3(0, -0.12, 0) }
	return {
		rig,
		place() {
			const { yaw, pitch, dist, target } = rig
			camera.position
				.set(Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw))
				.multiplyScalar(dist)
				.add(target)
			camera.lookAt(target)
		},
		rotate(dx: number, dy: number) {
			rig.yaw -= dx * 0.006
			rig.pitch = THREE.MathUtils.clamp(rig.pitch + dy * 0.005, 0.12, 1.45)
		},
		zoom(factor: number) {
			rig.dist = THREE.MathUtils.clamp(rig.dist * factor, MIN_DIST, MAX_DIST)
		},
	}
}

export type CameraRig = ReturnType<typeof createCameraRig>

export function attachPondInput(
	canvas: HTMLCanvasElement,
	camera: THREE.PerspectiveCamera,
	rig: CameraRig,
	{ onTap, onStir }: PondInputHandlers
) {
	const raycaster = new THREE.Raycaster()
	const ndc = new THREE.Vector2()
	const pointers = new Map<number, { x: number; y: number }>()
	let action: 'water' | 'rotate' | 'pinch' | null = null
	let pinch = 0,
		moved = 0
	let downAt: { x: number; z: number } | null = null

	// tia từ con trỏ cắt mặt phẳng y = 0, chỉ tính khi chỗ đó có nước
	function hitWater(clientX: number, clientY: number) {
		const r = canvas.getBoundingClientRect()
		ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1)
		raycaster.setFromCamera(ndc, camera)
		const o = raycaster.ray.origin,
			d = raycaster.ray.direction
		if (d.y > -1e-4) return null
		const t = -o.y / d.y,
			x = o.x + d.x * t,
			z = o.z + d.z * t
		return depthAt(x, z) > 0.03 ? { x, z } : null
	}

	const pinchDistance = () => {
		const [a, b] = [...pointers.values()]
		return Math.hypot(a.x - b.x, a.y - b.y)
	}

	const controller = new AbortController()
	const { signal } = controller
	canvas.addEventListener('contextmenu', (e) => e.preventDefault(), { signal })
	canvas.addEventListener(
		'pointerdown',
		(e) => {
			canvas.setPointerCapture(e.pointerId)
			pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
			if (pointers.size === 2) {
				pinch = pinchDistance()
				action = 'pinch'
				return
			}
			const hit = e.button === 0 ? hitWater(e.clientX, e.clientY) : null
			moved = 0
			if (hit) {
				action = 'water'
				downAt = hit
			} else action = 'rotate'
		},
		{ signal }
	)
	canvas.addEventListener(
		'pointermove',
		(e) => {
			const p = pointers.get(e.pointerId)
			if (!p) return
			const dx = e.clientX - p.x,
				dy = e.clientY - p.y
			p.x = e.clientX
			p.y = e.clientY
			moved += Math.abs(dx) + Math.abs(dy)
			if (action === 'pinch' && pointers.size === 2) {
				const d = pinchDistance()
				rig.zoom(pinch / Math.max(d, 1))
				pinch = d
			} else if (action === 'rotate') {
				rig.rotate(dx, dy)
			} else if (action === 'water' && moved > TAP_SLOP) {
				const hit = hitWater(e.clientX, e.clientY)
				if (hit) onStir(hit.x, hit.z)
			}
		},
		{ signal }
	)
	canvas.addEventListener(
		'pointerup',
		(e) => {
			if (action === 'water' && moved <= TAP_SLOP && downAt) onTap(downAt.x, downAt.z)
			pointers.delete(e.pointerId)
			if (!pointers.size) action = null
			else if (action === 'pinch') action = 'rotate'
		},
		{ signal }
	)
	canvas.addEventListener(
		'pointercancel',
		(e) => {
			pointers.delete(e.pointerId)
			if (!pointers.size) action = null
		},
		{ signal }
	)
	canvas.addEventListener(
		'wheel',
		(e) => {
			e.preventDefault()
			rig.zoom(Math.exp(e.deltaY * 0.001))
		},
		{ signal, passive: false }
	)

	return () => controller.abort()
}
