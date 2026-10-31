import * as THREE from 'three'

import type { Rocks } from './rocks'
import { floorH } from './terrain'
import type { WorldContext } from './types'

export function addIsland({ scene, rng }: WorldContext, rocks: Rocks) {
	const { addRock, rockMat, rockDark, mossMat, surfaceRocks } = rocks

	// island ring of boulders
	for (let i = 0; i < 26; i++) {
		const a = (i / 26) * Math.PI * 2 + rng() * 0.2,
			r = 6.5 + rng() * 3.2
		addRock(
			Math.cos(a) * r,
			Math.sin(a) * r,
			1.6 + rng() * 1.8,
			0.4,
			rng() < 0.5 ? rockMat : rockDark
		)
	}

	// grassy cap
	{
		const g = new THREE.CylinderGeometry(5.6, 6.4, 1.2, 14, 1)
		const cap = new THREE.Mesh(g, mossMat)
		cap.position.set(0, floorH(0, 0) - 0.2, 0)
		cap.receiveShadow = true
		scene.add(cap)
	}

	// sea stacks out in the water
	;[
		[24, -9, 3.6],
		[-20, -24, 3.2],
		[-31, 6, 2.4],
		[14, 30, 2.6],
		[32, 24, 1.8],
	].forEach(([x, z, s]) => {
		const m = addRock(x, z, s, -1.4 + (floorH(x, z) > -7 ? 0.6 : 0))
		m.scale.y *= 2.2
		m.position.y = floorH(x, z) + m.scale.y * 0.55
		surfaceRocks.push({ x, z, r: Math.max(m.scale.x, m.scale.z) * 0.95 })
	})
}
