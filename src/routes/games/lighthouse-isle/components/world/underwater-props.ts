import * as THREE from 'three'

import type { Rocks } from './rocks'
import { floorH } from './terrain'
import type { WorldContext } from './types'

export function addShipwreck({ scene, toon }: WorldContext) {
	const wood = toon('#8a5a3b'),
		woodD = toon('#6b4329')
	const ship = new THREE.Group()
	const hull = new THREE.Mesh(
		new THREE.CylinderGeometry(2.6, 1.6, 14, 8, 1, false, 0, Math.PI),
		wood
	)
	hull.rotation.z = Math.PI / 2
	hull.rotation.x = Math.PI
	ship.add(hull)
	const deck = new THREE.Mesh(new THREE.BoxGeometry(13, 0.35, 4.4), woodD)
	deck.position.y = 0.05
	ship.add(deck)
	const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 9, 8), woodD)
	mast.position.set(1, 3.8, 0)
	mast.rotation.z = -0.55
	ship.add(mast)
	const cabin = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 3), wood)
	cabin.position.set(-4, 0.9, 0)
	ship.add(cabin)
	ship.position.set(-27, floorH(-27, 20) + 1.4, 20)
	ship.rotation.set(0.25, 0.7, 0.18)
	ship.traverse((o) => {
		if (o instanceof THREE.Mesh) {
			o.castShadow = true
			o.receiveShadow = true
		}
	})

	scene.add(ship)
	// chest
	const chest = new THREE.Group()
	const box = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 1.5), toon('#a0632f'))
	const lid = new THREE.Mesh(
		new THREE.CylinderGeometry(0.75, 0.75, 2.2, 10, 1, false, 0, Math.PI),
		toon('#a0632f')
	)
	lid.rotation.z = Math.PI / 2
	lid.position.y = 0.65
	const band = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.5, 1.6), toon('#f1c232'))
	const gold = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), toon('#ffd54a'))
	gold.position.set(0.5, 0.7, 0.9)
	chest.add(box, lid, band, gold)
	chest.position.set(-19, floorH(-19, 27) + 0.6, 27)
	chest.rotation.y = 0.4
	chest.traverse((o) => {
		if (o instanceof THREE.Mesh) o.castShadow = true
	})
	scene.add(chest)
}

export function addAnchor({ scene, toon }: WorldContext) {
	const iron = toon('#4a5a6e')
	const a = new THREE.Group()
	const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 6, 8), iron)
	a.add(shank)
	const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.18, 6, 16), iron)
	ring.position.y = 3.5
	a.add(ring)
	const arm = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.28, 6, 16, Math.PI), iron)
	arm.rotation.z = Math.PI
	arm.position.y = -1.2
	a.add(arm)
	const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 3.4, 8), iron)
	bar.rotation.z = Math.PI / 2
	bar.position.y = 2.2
	a.add(bar)
	a.position.set(18, floorH(18, 22) + 1.0, 22)
	a.rotation.set(1.25, 0.6, 0.2)
	a.traverse((o) => {
		if (o instanceof THREE.Mesh) o.castShadow = true
	})
	scene.add(a)
}

export function addStarfish({ scene, rng, toon }: WorldContext) {
	const shape = new THREE.Shape()
	for (let i = 0; i <= 10; i++) {
		const a = (i / 10) * Math.PI * 2 + Math.PI / 2,
			r = i % 2 ? 0.45 : 1.1
		if (i) shape.lineTo(Math.cos(a) * r, Math.sin(a) * r)
		else shape.moveTo(Math.cos(a) * r, Math.sin(a) * r)
	}
	const g = new THREE.ExtrudeGeometry(shape, {
		depth: 0.25,
		bevelEnabled: true,
		bevelSize: 0.12,
		bevelThickness: 0.12,
		bevelSegments: 1,
	})
	g.rotateX(-Math.PI / 2)
	const cols = ['#ff7a59', '#ffb347', '#ef5b9c']
	for (let i = 0; i < 11; i++) {
		const x = 27 + (rng() - 0.5) * 16,
			z = -22 + (rng() - 0.5) * 12
		const s = new THREE.Mesh(g, toon(cols[i % 3]))
		s.position.set(x, floorH(x, z) + 0.12, z)
		s.rotation.y = rng() * 6.28
		s.scale.setScalar(0.8 + rng() * 0.6)
		scene.add(s)
	}
}

export function addCoral({ scene, rng, toon }: WorldContext) {
	const palette = ['#ff6f91', '#ff9671', '#c34a9b', '#f9a03f', '#7c5cbf']
	const spots = [
		[21, 3],
		[-15, 14],
		[9, -20],
		[-8, -19],
		[22, 15],
		[-21, -6],
		[4, 20],
		[33, -14],
		[-14, 22],
	]
	for (const [cx, cz] of spots) {
		for (let k = 0; k < 5; k++) {
			const x = cx + (rng() - 0.5) * 5,
				z = cz + (rng() - 0.5) * 5,
				y = floorH(x, z)
			const c = toon(palette[Math.floor(rng() * palette.length)])
			const kind = rng()
			let m
			if (kind < 0.4) m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 + rng() * 0.8, 1), c)
			else if (kind < 0.75)
				m = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.6 + rng() * 1.8, 6), c)
			else m = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 0.4, 0.5, 10), c)
			m.position.set(x, y + (kind < 0.4 ? 0.5 : kind < 0.75 ? 1.2 : 1.0), z)
			m.rotation.set((rng() - 0.5) * 0.4, rng() * 6, (rng() - 0.5) * 0.4)
			m.castShadow = true
			scene.add(m)
		}
	}
}

export function addSeabedRocks({ rng }: WorldContext, { addRock, rockMat, rockDark }: Rocks) {
	for (let i = 0; i < 26; i++) {
		const x = (rng() - 0.5) * 92,
			z = (rng() - 0.5) * 92
		if (Math.hypot(x, z) < 12) continue
		if (floorH(x, z) > -1.5) continue
		addRock(x, z, 0.8 + rng() * 1.6, 0.5, rng() < 0.5 ? rockMat : rockDark)
	}
}

export function addSeaweed({ scene, rng, toon }: WorldContext) {
	const g = new THREE.BoxGeometry(0.35, 4, 0.12, 1, 8, 1)
	g.translate(0, 2, 0)
	const pos: [x: number, z: number, s: number][] = []
	for (let i = 0; i < 400 && pos.length < 170; i++) {
		const x = (rng() - 0.5) * 94,
			z = (rng() - 0.5) * 94,
			y = floorH(x, z)
		if (y > -3.5 || Math.hypot(x, z) < 14) continue
		const n = 2 + Math.floor(rng() * 3)
		for (let k = 0; k < n; k++)
			pos.push([x + (rng() - 0.5) * 1.5, z + (rng() - 0.5) * 1.5, 0.7 + rng() * 0.8])
	}
	const mesh = new THREE.InstancedMesh(g, toon('#3fae6a', { sway: true }), pos.length)
	const m4 = new THREE.Matrix4(),
		q = new THREE.Quaternion(),
		e = new THREE.Euler()
	pos.forEach(([x, z, s], i) => {
		e.set(0, rng() * 6.28, 0)
		q.setFromEuler(e)
		m4.compose(new THREE.Vector3(x, floorH(x, z) - 0.1, z), q, new THREE.Vector3(1, s, 1))
		mesh.setMatrixAt(i, m4)
		mesh.setColorAt(
			i,
			new THREE.Color().setHSL(0.33 + (rng() - 0.5) * 0.08, 0.55, 0.38 + rng() * 0.12)
		)
	})
	scene.add(mesh)
}
