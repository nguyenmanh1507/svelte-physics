import * as THREE from 'three'

import type { WorldContext } from './types'
import type { Waves } from './waves'

export function createBuoy({ scene, toon }: WorldContext, { waveHeight }: Waves) {
	const buoy = new THREE.Group()
	const r = toon('#e04a3f'),
		w = toon('#fbf6ec')
	const b1 = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 1.6, 12), r)
	const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 1.2, 12), w)
	b2.position.y = 1.4
	const b3 = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.2, 12), r)
	b3.position.y = 2.6
	buoy.add(b1, b2, b3)
	buoy.position.set(10, 0, -33)
	buoy.traverse((o) => {
		if (o instanceof THREE.Mesh) o.castShadow = true
	})
	scene.add(buoy)

	return function update(t: number) {
		const bh = waveHeight(buoy.position.x, buoy.position.z, t)
		buoy.position.y = bh - 0.4
		const hx = waveHeight(buoy.position.x + 1, buoy.position.z, t) - bh,
			hz = waveHeight(buoy.position.x, buoy.position.z + 1, t) - bh
		buoy.rotation.set(hz * 0.6, 0, -hx * 0.6)
	}
}
