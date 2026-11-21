import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { applySurfaces, createSurface, driveSurface } from './gltf-rig'

// quaternion bản lề lấy nguyên từ B777_web.glb: bên phải export dạng đối xứng (trục Y cục bộ hướng xuống)
const AILERON_L = new THREE.Quaternion(-0.012, 0.212, 0.054, 0.976).normalize()
const AILERON_R = new THREE.Quaternion(-0.212, 0.012, 0.976, 0.054).normalize()

/** vị trí (trong hệ cha) của điểm mép sau, cách bản lề 1 m về phía −Z cục bộ */
function trailingEdge(q: THREE.Quaternion, angle: number, axis: 'x' | 'y' = 'x') {
	const node = new THREE.Object3D()
	node.quaternion.copy(q)
	const sf = createSurface(node, axis)
	driveSurface(sf, angle, 1)
	applySurfaces([sf])
	return new THREE.Vector3(0, 0, -1).applyQuaternion(node.quaternion)
}

describe('createSurface', () => {
	it('positive angle raises the trailing edge on both normal and mirrored nodes', () => {
		for (const q of [AILERON_L, AILERON_R]) {
			const rest = trailingEdge(q, 0).y
			expect(trailingEdge(q, 0.3).y).toBeGreaterThan(rest + 0.2)
			expect(trailingEdge(q, -0.3).y).toBeLessThan(rest - 0.2)
		}
	})

	it('positive yaw angle swings the trailing edge to the aircraft right (−X in GLB space)', () => {
		const rudder = new THREE.Quaternion(-0.253, 0, 0, 0.967).normalize()
		expect(trailingEdge(rudder, 0.3, 'y').x).toBeLessThan(-0.2)
	})

	it('slides along the local direction without drifting at rest', () => {
		const node = new THREE.Object3D()
		node.position.set(3, 1, 2)
		node.quaternion.copy(AILERON_R)
		const sf = createSurface(node, 'x', new THREE.Vector3(0, 0, -1))
		applySurfaces([sf])
		expect(node.position.toArray()).toEqual([3, 1, 2])
		driveSurface(sf, 0, 1, 1)
		applySurfaces([sf])
		// lùi 1 m về phía đuôi (−Z trong hệ GLB, mũi +Z)
		expect(node.position.distanceTo(new THREE.Vector3(3, 1, 2))).toBeCloseTo(1)
		expect(node.position.z).toBeLessThan(2 - 0.8)
	})
})
