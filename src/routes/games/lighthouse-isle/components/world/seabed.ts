import * as THREE from 'three'

import { BASE_Y, floorH, HALF, smooth } from './terrain'
import type { WorldContext } from './types'

export function addSeabed({ scene, toon }: WorldContext) {
	const g = new THREE.PlaneGeometry(100, 100, 200, 200)
	g.rotateX(-Math.PI / 2)
	const p = g.attributes.position,
		col = new Float32Array(p.count * 3)
	const sandA = new THREE.Color('#f5cf7f'),
		sandB = new THREE.Color('#e0ac5c'),
		sandC = new THREE.Color('#fbe3a7')
	const tmp = new THREE.Color()
	for (let i = 0; i < p.count; i++) {
		const x = p.getX(i),
			z = p.getZ(i),
			y = floorH(x, z)
		p.setY(i, y)
		const n = 0.5 + 0.5 * Math.sin(x * 0.31 + Math.sin(z * 0.2) * 2.0) // vân cát
		tmp
			.copy(sandA)
			.lerp(sandB, smooth(-2, -11, y) * 0.55) // chỗ sâu sẫm hơn
			.lerp(sandC, smooth(0.2, 2.5, y) * 0.8) // chỗ khô trên đảo sáng hơn
		tmp.multiplyScalar(0.94 + 0.06 * n)
		col.set([tmp.r, tmp.g, tmp.b], i * 3)
	}
	g.setAttribute('color', new THREE.BufferAttribute(col, 3))
	g.computeVertexNormals()
	const floor = new THREE.Mesh(g, toon(0xffffff, { vertexColors: true }))
	floor.receiveShadow = true
	scene.add(floor)

	// Sand slab sides with strata
	const strata = ['#f2c76e', '#e3ad58', '#c98d47', '#e3ad58', '#b9783c'].map(
		(c) => new THREE.Color(c)
	)
	const sideGeo = (pts: [x: number, z: number][]) => {
		const pos: number[] = [],
			cols: number[] = [],
			idx: number[] = []
		const L = 5 // vertical rows
		pts.forEach(([x, z], i) => {
			const top = floorH(x, z)
			for (let r = 0; r <= L; r++) {
				const t = r / L,
					y = top + (BASE_Y - top) * t
				pos.push(x, y, z)
				const band =
					strata[
						Math.min(
							strata.length - 1,
							Math.floor(
								((top - y) / (top - BASE_Y)) * strata.length + 0.4 * Math.sin(x * 0.3 + z * 0.3)
							)
						)
					] || strata[0]
				cols.push(band.r, band.g, band.b)
			}
			if (i > 0)
				for (let r = 0; r < L; r++) {
					const a = (i - 1) * (L + 1) + r,
						b = i * (L + 1) + r
					idx.push(a, a + 1, b, b, a + 1, b + 1)
				}
		})
		const g2 = new THREE.BufferGeometry()
		g2.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
		g2.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3))
		g2.setIndex(idx)
		g2.computeVertexNormals()
		return g2
	}

	const N = 120,
		sides = []
	const lin = (f: (s: number) => [x: number, z: number]) =>
		Array.from({ length: N + 1 }, (_, i) => f(-HALF + (100 * i) / N))
	sides.push(
		lin((s) => [s, HALF]),
		lin((s) => [HALF, -s]),
		lin((s) => [-s, -HALF]),
		lin((s) => [-HALF, s])
	)
	const sideMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })
	for (const pts of sides) scene.add(new THREE.Mesh(sideGeo(pts), sideMat))
	const plinth = new THREE.Mesh(
		new THREE.BoxGeometry(106, 3, 106),
		new THREE.MeshBasicMaterial({ color: '#2b4a6b' })
	)
	plinth.position.y = BASE_Y - 1.5
	scene.add(plinth)
}
