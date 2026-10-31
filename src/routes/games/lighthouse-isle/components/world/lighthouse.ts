import * as THREE from 'three'

import { floorH } from './terrain'
import type { WorldContext } from './types'

/** Returns the rotating beam, which the caller draws only in the second pass. */
export function addLighthouse({ scene, toon }: WorldContext) {
	const lighthouse = new THREE.Group()
	{
		const baseY = floorH(0, 0) + 0.3
		const stone = toon('#c9c3b8'),
			red = toon('#e04a3f'),
			white = toon('#fbf6ec'),
			dark = toon('#24364d')
		const plat = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.8, 1.4, 20), stone)
		plat.position.y = baseY + 0.6
		lighthouse.add(plat)
		const H = 17,
			segs = 6
		for (let i = 0; i < segs; i++) {
			const r0 = 3.0 - (i / segs) * 1.0,
				r1 = 3.0 - ((i + 1) / segs) * 1.0
			const seg = new THREE.Mesh(
				new THREE.CylinderGeometry(r1, r0, H / segs, 24),
				i % 2 ? white : red
			)
			seg.position.y = baseY + 1.3 + (i + 0.5) * (H / segs)
			lighthouse.add(seg)
		}
		const topY = baseY + 1.3 + H
		const gallery = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.4, 0.6, 24), dark)
		gallery.position.y = topY + 0.3
		lighthouse.add(gallery)
		const rail = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.09, 6, 32), dark)
		rail.rotation.x = Math.PI / 2
		rail.position.y = topY + 1.4
		lighthouse.add(rail)
		for (let i = 0; i < 12; i++) {
			const a = (i / 12) * Math.PI * 2
			const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), dark)
			post.position.set(Math.cos(a) * 2.7, topY + 0.95, Math.sin(a) * 2.7)
			lighthouse.add(post)
		}
		const lantern = new THREE.Mesh(
			new THREE.CylinderGeometry(1.45, 1.45, 2.2, 16),
			new THREE.MeshBasicMaterial({ color: '#ffe17a' })
		)
		lantern.position.y = topY + 1.7
		lighthouse.add(lantern)
		const roof = new THREE.Mesh(new THREE.ConeGeometry(2.1, 2.2, 16), red)
		roof.position.y = topY + 3.9
		lighthouse.add(roof)
		const ball = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), dark)
		ball.position.y = topY + 5.1
		lighthouse.add(ball)
		const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.4), dark)
		door.position.set(0, baseY + 2.4, 2.85)
		lighthouse.add(door)
		for (let i = 0; i < 3; i++) {
			const w = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.3), dark)
			const y = baseY + 6 + i * 4.3,
				r = 3.0 - ((y - baseY - 1.3) / H) * 1.0
			w.position.set(-r * 0.7, y, -r * 0.72)
			w.rotation.y = Math.PI / 4
			lighthouse.add(w)
		}
		lighthouse.traverse((o) => {
			if (o instanceof THREE.Mesh) {
				o.castShadow = true
				o.receiveShadow = true
			}
		})
		lighthouse.userData.lampY = topY + 1.7
		scene.add(lighthouse)
	}

	const beam = new THREE.Group()
	{
		const g = new THREE.ConeGeometry(4.5, 46, 24, 1, true)
		g.translate(0, -23, 0)
		g.rotateZ(Math.PI / 2)
		const m = new THREE.ShaderMaterial({
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
			side: THREE.DoubleSide,
			vertexShader:
				'varying float vX; void main(){ vX = position.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
			fragmentShader:
				'varying float vX; void main(){ float a = pow(1.0 - clamp(vX / 46.0, 0.0, 1.0), 2.2) * 0.33; gl_FragColor = vec4(vec3(1.0, 0.92, 0.6) * a, 1.0); }',
		})
		const c1 = new THREE.Mesh(g, m),
			c2 = new THREE.Mesh(g, m)
		c2.rotation.y = Math.PI
		beam.add(c1, c2)
		beam.position.y = lighthouse.userData.lampY
	}
	return beam
}
