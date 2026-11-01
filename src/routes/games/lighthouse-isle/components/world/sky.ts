import * as THREE from 'three'

import type { WorldContext } from './types'

export function createSkyTexture() {
	const cv = document.createElement('canvas')
	cv.width = 4
	cv.height = 256
	const g = cv.getContext('2d')
	if (!g) throw new Error('2D canvas is not supported')
	const gr = g.createLinearGradient(0, 0, 0, 256)
	gr.addColorStop(0, '#6fc6ec')
	gr.addColorStop(0.55, '#b9e6f4')
	gr.addColorStop(1, '#fbeed2')
	g.fillStyle = gr
	g.fillRect(0, 0, 4, 256)
	const tex = new THREE.CanvasTexture(cv)
	tex.colorSpace = THREE.SRGBColorSpace
	return tex
}

export function createClouds({ scene, rng, toon }: WorldContext) {
	const clouds: THREE.Group[] = []
	const m = toon('#ffffff')
	for (let i = 0; i < 4; i++) {
		const c = new THREE.Group()
		for (let k = 0; k < 5; k++) {
			const s = new THREE.Mesh(new THREE.IcosahedronGeometry(3 + rng() * 2.5, 1), m)
			s.position.set((k - 2) * 3.4 + rng(), rng() * 2, (rng() - 0.5) * 3)
			c.add(s)
		}
		c.position.set(-60 + i * 40, 52 + rng() * 10, (i % 2 ? -1 : 1) * (28 + rng() * 25))
		scene.add(c)
		clouds.push(c)
	}

	return function update(dt: number) {
		clouds.forEach((c, i) => {
			c.position.x += dt * (1.2 + i * 0.3)
			if (c.position.x > 90) c.position.x = -90
		})
	}
}
