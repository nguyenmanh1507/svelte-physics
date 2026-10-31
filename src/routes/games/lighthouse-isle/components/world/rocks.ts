import * as THREE from 'three'

import { floorH } from './terrain'
import type { WorldContext } from './types'

export type SurfaceRock = { x: number; z: number; r: number }

export function createRocks({ scene, rng, toon }: WorldContext) {
	const rockMat = toon('#8d8f98'),
		rockDark = toon('#6d6f7c'),
		mossMat = toon('#6aa65b')
	const surfaceRocks: { x: number; z: number; r: number }[] = [] // rocks that break the surface: splash emitters

	function addRock(x: number, z: number, s: number, sink = 0.35, mat = rockMat) {
		const g = new THREE.DodecahedronGeometry(1, 0)
		const p = g.attributes.position
		for (let i = 0; i < p.count; i++)
			p.setXYZ(
				i,
				p.getX(i) * (0.85 + rng() * 0.3),
				p.getY(i) * (0.75 + rng() * 0.3),
				p.getZ(i) * (0.85 + rng() * 0.3)
			)
		g.computeVertexNormals()
		const m = new THREE.Mesh(g, mat)
		m.scale.set(s * (0.9 + rng() * 0.5), s * (0.7 + rng() * 0.5), s * (0.9 + rng() * 0.5))
		m.position.set(x, floorH(x, z) + s * (1 - sink) * 0.6, z)
		m.rotation.set(rng() * 0.5, rng() * 6.28, rng() * 0.5)
		m.castShadow = m.receiveShadow = true
		scene.add(m)
		const top = m.position.y + m.scale.y * 0.8
		if (top > 0.3) surfaceRocks.push({ x, z, r: Math.max(m.scale.x, m.scale.z) * 0.95 })
		return m
	}

	return { addRock, rockMat, rockDark, mossMat, surfaceRocks }
}

export type Rocks = ReturnType<typeof createRocks>
