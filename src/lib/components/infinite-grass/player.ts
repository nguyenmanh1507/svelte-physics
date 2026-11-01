import * as THREE from 'three'
import type { Interactor } from './trample-map'

const UP = new THREE.Vector3(0, 1, 0)

// Nhân vật demo: quả bóng lăn trên mặt đất và đè cỏ quanh nó.
// Mọi thứ cần đè cỏ chỉ phải có `position` + `trampleRadius` (Interactor), không riêng class này.
export class PlayerBall implements Interactor {
	readonly mesh: THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshStandardMaterial>
	readonly position: THREE.Vector3
	readonly radius: number
	trampleRadius: number
	bounds = Infinity // m, giới hạn |x| và |z| (giữ trên mặt đất)

	#axis = new THREE.Vector3()
	#roll = new THREE.Quaternion()

	constructor(radius = 0.6, trampleRadius = 1.6) {
		this.radius = radius
		this.trampleRadius = trampleRadius
		this.mesh = new THREE.Mesh(
			new THREE.IcosahedronGeometry(radius, 1),
			// flat shading để thấy rõ bóng đang lăn
			new THREE.MeshStandardMaterial({ color: 0xf2a541, roughness: 0.55, flatShading: true })
		)
		this.position = this.mesh.position
	}

	// move: hướng đi trên mặt đất (xz), speed: m/s, groundHeight: độ cao mặt đất tại (x, z)
	update(
		delta: number,
		move: THREE.Vector2,
		speed: number,
		groundHeight: (x: number, z: number) => number
	) {
		const step = speed * delta
		const p = this.position
		const b = this.bounds
		p.x = THREE.MathUtils.clamp(p.x + move.x * step, -b, b)
		p.z = THREE.MathUtils.clamp(p.z + move.y * step, -b, b)
		p.y = groundHeight(p.x, p.z) + this.radius

		// lăn không trượt: quay quanh trục vuông góc hướng đi một góc = quãng đường / bán kính
		if (step > 0 && move.lengthSq() > 0) {
			this.#axis.set(move.x, 0, move.y).cross(UP).negate().normalize()
			this.#roll.setFromAxisAngle(this.#axis, (step * move.length()) / this.radius)
			this.mesh.quaternion.premultiply(this.#roll)
		}
	}

	dispose() {
		this.mesh.geometry.dispose()
		this.mesh.material.dispose()
	}
}
