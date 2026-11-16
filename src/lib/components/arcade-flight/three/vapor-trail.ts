import * as THREE from 'three'

import { clamp01 } from '../core'

type TrailPoint = { p: THREE.Vector3; up: THREE.Vector3; a: number }

/** Dải hơi nước ở đầu cánh: ribbon 2 đỉnh/điểm, mờ dần theo tuổi và khi đi qua gần camera */
export class VaporTrail {
	readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
	private pts: TrailPoint[] = []
	private pos: Float32Array
	private col: Float32Array

	constructor(private n = 90) {
		const geo = new THREE.BufferGeometry()
		this.pos = new Float32Array(n * 2 * 3)
		this.col = new Float32Array(n * 2 * 4)
		geo.setAttribute(
			'position',
			new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage)
		)
		geo.setAttribute(
			'color',
			new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage)
		)
		const idx: number[] = []
		for (let i = 0; i < n - 1; i++) {
			const a = i * 2
			idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
		}
		geo.setIndex(idx)
		this.mesh = new THREE.Mesh(
			geo,
			new THREE.MeshBasicMaterial({
				vertexColors: true,
				transparent: true,
				depthWrite: false,
				side: THREE.DoubleSide,
				fog: true,
			})
		)
		this.mesh.frustumCulled = false
	}

	push(p: THREE.Vector3, up: THREE.Vector3, width: number, alpha: number) {
		const recycled = this.pts.length >= this.n ? this.pts.pop() : undefined
		const pt = recycled ?? { p: new THREE.Vector3(), up: new THREE.Vector3(), a: 0 }
		pt.p.copy(p)
		pt.up.copy(up).multiplyScalar(width)
		pt.a = alpha
		this.pts.unshift(pt)
	}

	update(cameraPos: THREE.Vector3) {
		const last = this.pts[this.pts.length - 1]
		for (let i = 0; i < this.n; i++) {
			const q = this.pts[i] ?? last
			if (!q) continue
			const near = clamp01((q.p.distanceTo(cameraPos) - 8) / 45)
			const a = this.pts[i] ? q.a * (1 - i / this.n) * near * 0.6 * 0.7 : 0
			const o = i * 6
			this.pos[o] = q.p.x + q.up.x
			this.pos[o + 1] = q.p.y + q.up.y
			this.pos[o + 2] = q.p.z + q.up.z
			this.pos[o + 3] = q.p.x - q.up.x
			this.pos[o + 4] = q.p.y - q.up.y
			this.pos[o + 5] = q.p.z - q.up.z
			const c = i * 8
			this.col.fill(1, c, c + 8)
			this.col[c + 3] = a
			this.col[c + 7] = a
		}
		this.mesh.geometry.attributes.position.needsUpdate = true
		this.mesh.geometry.attributes.color.needsUpdate = true
	}

	clear() {
		this.pts.length = 0
	}

	dispose() {
		this.mesh.removeFromParent()
		this.mesh.geometry.dispose()
		this.mesh.material.dispose()
	}
}
