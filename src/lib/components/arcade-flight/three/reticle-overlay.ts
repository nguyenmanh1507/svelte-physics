import * as THREE from 'three'

import type { ArcadeFlightController } from './arcade-flight-controller'

const HUD_GREEN = 'rgba(125,255,176,.9)'
const AIM_WHITE = 'rgba(255,255,255,.85)'

/** Lớp canvas 2D phủ lên scene: dấu mũi (+), flight-path marker và vòng ngắm mouse-aim */
export class ReticleOverlay {
	readonly canvas: HTMLCanvasElement
	private ctx: CanvasRenderingContext2D
	private v = new THREE.Vector3()
	private w = 0
	private h = 0

	constructor(host: HTMLElement) {
		this.canvas = document.createElement('canvas')
		Object.assign(this.canvas.style, {
			position: 'absolute',
			inset: '0',
			width: '100%',
			height: '100%',
			pointerEvents: 'none',
		})
		host.appendChild(this.canvas)
		this.ctx = this.canvas.getContext('2d')!
	}

	/** kích thước CSS px của vùng vẽ */
	setSize(width: number, height: number) {
		const dpr = Math.min(devicePixelRatio, 2)
		this.w = width
		this.h = height
		this.canvas.width = Math.round(width * dpr)
		this.canvas.height = Math.round(height * dpr)
		this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
	}

	draw(flight: ArcadeFlightController) {
		const g = this.ctx
		g.clearRect(0, 0, this.w, this.h)
		if (flight.crashed) return
		const { nose, fpm, aim } = flight.markers()
		g.lineWidth = 1.5
		g.strokeStyle = HUD_GREEN
		g.fillStyle = HUD_GREEN

		const n = this.project(nose, flight.camera)
		if (n) {
			const [x, y] = n
			g.beginPath()
			g.moveTo(x - 10, y)
			g.lineTo(x - 3, y)
			g.moveTo(x + 3, y)
			g.lineTo(x + 10, y)
			g.moveTo(x, y - 10)
			g.lineTo(x, y - 3)
			g.moveTo(x, y + 3)
			g.lineTo(x, y + 10)
			g.stroke()
		}
		const f = fpm && this.project(fpm, flight.camera)
		if (f) {
			const [x, y] = f
			g.beginPath()
			g.arc(x, y, 6, 0, Math.PI * 2)
			g.moveTo(x - 14, y)
			g.lineTo(x - 6, y)
			g.moveTo(x + 6, y)
			g.lineTo(x + 14, y)
			g.moveTo(x, y - 6)
			g.lineTo(x, y - 12)
			g.stroke()
		}
		const a = aim && this.project(aim, flight.camera)
		if (a) {
			g.strokeStyle = AIM_WHITE
			g.fillStyle = AIM_WHITE
			g.beginPath()
			g.arc(a[0], a[1], 16, 0, Math.PI * 2)
			g.stroke()
			g.beginPath()
			g.arc(a[0], a[1], 2, 0, Math.PI * 2)
			g.fill()
		}
	}

	dispose() {
		this.canvas.remove()
	}

	private project(p: THREE.Vector3, camera: THREE.Camera): [number, number] | null {
		const v = this.v.copy(p).project(camera)
		if (v.z > 1) return null
		return [((v.x + 1) / 2) * this.w, ((1 - v.y) / 2) * this.h]
	}
}
