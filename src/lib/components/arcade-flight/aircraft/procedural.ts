// Model dựng bằng primitive (mũi −Z) cho máy bay biểu diễn của prototype.
import * as THREE from 'three'

import type { AircraftFrame, AircraftRig } from '../three/aircraft-rig'
import { disposeObject } from '../three/dispose'

const mat = (color: string, opts: THREE.MeshStandardMaterialParameters = {}) =>
	new THREE.MeshStandardMaterial({
		color,
		roughness: 0.55,
		metalness: 0.25,
		flatShading: true,
		...opts,
	})

function mesh(geo: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
	const m = new THREE.Mesh(geo, material)
	m.position.set(x, y, z)
	return m
}

const canopyMat = () => mat('#1d2a36', { metalness: 0.8, roughness: 0.15 })

/** cánh quạt quay nhanh dần theo ga */
function propAnimator(props: THREE.Object3D[]) {
	let ang = 0
	return ({ state, dt }: AircraftFrame) => {
		ang += dt * (20 + state.throttle * 60)
		for (const p of props) p.rotation.z = ang
	}
}

export function buildAerobaticRig(): AircraftRig {
	const g = new THREE.Group()
	const red = mat('#d23b2f')
	const white = mat('#f1efe9')
	const dark = mat('#262a2e')
	const fus = mesh(new THREE.CylinderGeometry(0.45, 0.25, 6, 10), white, 0, 0, 0.6)
	fus.rotation.x = Math.PI / 2
	g.add(fus)
	const cowl = mesh(new THREE.CylinderGeometry(0.55, 0.5, 1.6, 12), red, 0, 0, -2.9)
	cowl.rotation.x = Math.PI / 2
	g.add(cowl)
	const can = mesh(new THREE.SphereGeometry(0.42, 10, 8), canopyMat(), 0, 0.42, -0.6)
	can.scale.set(1, 0.9, 2)
	g.add(can)
	g.add(mesh(new THREE.BoxGeometry(7.6, 0.14, 1.5), red, 0, -0.2, -1.2))
	g.add(mesh(new THREE.BoxGeometry(2.8, 0.1, 0.8), red, 0, 0.05, 3.3))
	g.add(mesh(new THREE.BoxGeometry(0.1, 1.2, 0.9), white, 0, 0.6, 3.4))
	const prop = new THREE.Group()
	prop.position.set(0, 0, -3.8)
	prop.add(mesh(new THREE.BoxGeometry(2.0, 0.16, 0.05), dark))
	prop.add(mesh(new THREE.BoxGeometry(0.16, 2.0, 0.05), dark))
	const spinner = mesh(new THREE.ConeGeometry(0.22, 0.5, 10), red, 0, 0, -0.2)
	spinner.rotation.x = -Math.PI / 2
	prop.add(spinner)
	g.add(prop)
	return {
		object: g,
		span: 3.8,
		camDist: 15,
		camH: 3.4,
		shadowSize: 6,
		animate: propAnimator([prop]),
		dispose: () => disposeObject(g),
	}
}
