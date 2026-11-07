import * as THREE from 'three'
import type { Food } from './koi-steering'
import { INSTANCED_WORLD_VERT, litColorMaterial, type PondUniforms } from './shading'
import { depthAt } from './terrain'
import type { WaveSim } from './wave-sim'

// Viên thức ăn nổi trên mặt nước, trôi chậm, dội lại khi chạm chỗ nông.

const MAX_FOOD = 48

export function createFood(uniforms: PondUniforms, sim: WaveSim) {
	const items: Food[] = []
	const material = litColorMaterial(uniforms, [0.62, 0.42, 0.22], {
		vertexShader: INSTANCED_WORLD_VERT,
	})
	const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.011, 8, 6), material, MAX_FOOD)
	mesh.count = 0
	mesh.frustumCulled = false
	const m4 = new THREE.Matrix4()

	return {
		mesh,
		items,
		drop(x: number, z: number, n: number) {
			for (let i = 0; i < n && items.length < MAX_FOOD; i++) {
				const fx = x + (Math.random() - 0.5) * 0.25,
					fz = z + (Math.random() - 0.5) * 0.25
				if (depthAt(fx, fz) < 0.05) continue
				items.push({
					x: fx,
					z: fz,
					vx: (Math.random() - 0.5) * 0.02,
					vz: (Math.random() - 0.5) * 0.02,
				})
			}
			sim.addDrop(x, z, -0.006, 0.12)
		},
		update(dt: number) {
			items.forEach((fd, i) => {
				fd.x += fd.vx * dt
				fd.z += fd.vz * dt
				if (depthAt(fd.x, fd.z) < 0.04) {
					fd.vx *= -1
					fd.vz *= -1
				}
				m4.makeTranslation(fd.x, sim.sample(fd.x, fd.z) + 0.004, fd.z)
				mesh.setMatrixAt(i, m4)
			})
			mesh.count = items.length
			mesh.instanceMatrix.needsUpdate = true
		},
	}
}
