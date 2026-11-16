import * as THREE from 'three'

/** Nón lửa đuôi cộng sáng; gốc tại miệng phụt, đỉnh hướng ra sau theo `dir` (±Z cục bộ) */
export function createFlame(radius: number, length: number, dir: 1 | -1 = 1) {
	const g = new THREE.ConeGeometry(radius, length, 12, 1, true)
	g.rotateX((dir * Math.PI) / 2)
	g.translate(0, 0, (dir * length) / 2)
	return new THREE.Mesh(
		g,
		new THREE.MeshBasicMaterial({
			color: '#ff9a3c',
			transparent: true,
			opacity: 0.85,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
			side: THREE.DoubleSide,
		})
	)
}

/** Co giãn lửa theo ga và afterburner (giống prototype) */
export function updateFlame(
	f: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>,
	throttle: number,
	ab: number
) {
	const k = 0.25 + throttle * 0.5 + ab * 1.3
	const r = 0.6 + ab * 0.5
	f.scale.set(r, r, k * (0.9 + Math.random() * 0.2))
	f.material.color.set(ab > 0.2 ? '#ffb15a' : '#ff6a2a')
	f.material.opacity = 0.25 + ab * 0.6
}
