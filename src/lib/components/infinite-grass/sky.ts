import * as THREE from 'three'
import type { SharedUniforms } from './shared-uniforms'
import vertexShader from './shaders/sky.vert?raw'
import fragmentShader from './shaders/sky.frag?raw'

const SKY_RADIUS = 5000

// Vòm trời: quả cầu lớn nhìn từ bên trong, tô gradient theo toạ độ màn hình
export class Sky {
	readonly mesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>

	constructor(shared: SharedUniforms) {
		const material = new THREE.ShaderMaterial({
			uniforms: { resolution: shared.resolution },
			vertexShader,
			fragmentShader,
			side: THREE.BackSide,
		})
		this.mesh = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 32, 15), material)
	}

	dispose() {
		this.mesh.geometry.dispose()
		this.mesh.material.dispose()
	}
}
