import * as THREE from 'three'

const UP = new THREE.Vector3(0, 1, 0)
const _p = new THREE.Vector3()

// Mặt trời đi theo nhân vật: shadow camera chỉ phủ ±halfSize m quanh tâm, nên phải dời theo
// để thế giới vô hạn vẫn có bóng. Tâm được làm tròn theo kích thước một texel của shadow map
// trong không gian của đèn, nên bóng không rung lấp lánh khi di chuyển.
export class SunRig {
	readonly light: THREE.DirectionalLight
	#offset: THREE.Vector3 // từ tâm đến vị trí đèn
	#texel: number // m, cạnh một texel shadow map
	#toWorld = new THREE.Matrix4() // trục của shadow camera (nhìn từ đèn về tâm)
	#toLight = new THREE.Matrix4()

	constructor({ direction = new THREE.Vector3(5, 20, 5), halfSize = 20, mapSize = 4096 } = {}) {
		const light = new THREE.DirectionalLight(0xffffff, 1)
		light.castShadow = true
		const cam = light.shadow.camera
		cam.left = cam.bottom = -halfSize
		cam.right = cam.top = halfSize
		cam.near = 0.5
		cam.far = direction.length() * 2 + halfSize
		cam.updateProjectionMatrix()
		light.shadow.mapSize.set(mapSize, mapSize)
		light.shadow.bias = -0.0005
		light.shadow.normalBias = 0.02
		this.light = light

		this.#offset = direction.clone()
		this.#texel = (halfSize * 2) / mapSize
		this.#toWorld.lookAt(this.#offset, new THREE.Vector3(), UP)
		this.#toLight.copy(this.#toWorld).invert()
	}

	// thêm cả đèn lẫn target vào scene
	addTo(scene: THREE.Object3D) {
		scene.add(this.light, this.light.target)
	}

	follow(center: THREE.Vector3) {
		_p.copy(center).applyMatrix4(this.#toLight)
		_p.x = Math.round(_p.x / this.#texel) * this.#texel
		_p.y = Math.round(_p.y / this.#texel) * this.#texel
		_p.applyMatrix4(this.#toWorld)
		this.light.target.position.copy(_p)
		this.light.position.copy(_p).add(this.#offset)
	}

	dispose() {
		this.light.removeFromParent()
		this.light.target.removeFromParent()
		this.light.dispose()
	}
}
