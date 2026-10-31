import * as THREE from 'three'

import { floorH } from './terrain'
import type { WorldContext } from './types'

type School = { c: number[]; R: number; y: number; n: number; col: string; sp: number }
type Fish = { g: THREE.Group; t: THREE.Mesh; s: School; ph: number; dy: number; dr: number }

export function createFish({ scene, rng, toon }: WorldContext) {
	const fish: Fish[] = []
	const body = new THREE.SphereGeometry(1, 10, 8)
	body.scale(1.1, 0.55, 0.35)
	const tail = new THREE.ConeGeometry(0.55, 0.8, 4)
	tail.rotateZ(Math.PI / 2)
	tail.translate(-1.35, 0, 0)
	const schools: School[] = [
		{ c: [-12, -8], R: 16, y: -5, n: 7, col: '#ffb347', sp: 0.22 },
		{ c: [14, 12], R: 11, y: -7, n: 6, col: '#4fc3f7', sp: -0.3 },
		{ c: [-24, 18], R: 9, y: -6.5, n: 5, col: '#ff7096', sp: 0.35 },
	]
	for (const s of schools) {
		const mat = toon(s.col)
		for (let i = 0; i < s.n; i++) {
			const g = new THREE.Group()
			const b = new THREE.Mesh(body, mat),
				t = new THREE.Mesh(tail, mat)
			g.add(b, t)
			g.scale.setScalar(0.7 + rng() * 0.3)
			scene.add(g)
			fish.push({
				g,
				t,
				s,
				ph: (i / s.n) * 0.9 + rng() * 0.2,
				dy: (rng() - 0.5) * 2,
				dr: (rng() - 0.5) * 3,
			})
		}
	}

	return function update(t: number) {
		for (const f of fish) {
			const a = t * f.s.sp + f.ph * Math.PI * 2
			const R = f.s.R + f.dr
			const x = f.s.c[0] + Math.cos(a) * R,
				z = f.s.c[1] + Math.sin(a) * R
			const y = Math.max(
				floorH(x, z) + 1.5,
				Math.min(-1.8, f.s.y + f.dy + Math.sin(t * 0.8 + f.ph * 9) * 0.6)
			)
			f.g.position.set(x, y, z)
			const dir = Math.sign(f.s.sp)
			f.g.rotation.y = -a - (dir * Math.PI) / 2 + (dir < 0 ? Math.PI : 0)
			f.t.rotation.y = Math.sin(t * 9 + f.ph * 20) * 0.45
		}
	}
}
