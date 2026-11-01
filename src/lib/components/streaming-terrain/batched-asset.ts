import * as THREE from 'three'

const INITIAL_CAPACITY = 64

type Part = { mesh: THREE.BatchedMesh; geometryId: number; local: THREE.Matrix4 }

const _matrix = new THREE.Matrix4()

// Một model (vd. cây = cành + lá) vẽ bằng BatchedMesh: mỗi mesh con của model là một BatchedMesh,
// mọi bản sao trên mọi ô chỉ tốn một draw call cho mỗi mesh con (thay vì một draw call cho mỗi bản clone),
// và vẫn được frustum cull từng bản sao.
// Các mesh con thêm / xoá instance cùng lúc nên một id dùng chung cho mọi mesh con.
export class BatchedAsset {
	readonly object = new THREE.Group()
	#parts: Part[] = []
	#materials = new Set<THREE.Material>()
	#count = 0

	constructor(root: THREE.Object3D) {
		root.updateMatrixWorld(true)
		const toRoot = root.matrixWorld.clone().invert()

		root.traverse((node) => {
			if (!(node instanceof THREE.Mesh)) return
			const material = node.material as THREE.Material
			const geometry = node.geometry as THREE.BufferGeometry
			const vertexCount = geometry.attributes.position.count
			const indexCount = geometry.index?.count ?? vertexCount

			const mesh = new THREE.BatchedMesh(INITIAL_CAPACITY, vertexCount, indexCount, material)
			const geometryId = mesh.addGeometry(geometry)
			// BatchedMesh không cập nhật bounding sphere khi thêm instance -> tắt cull cả khối,
			// perObjectFrustumCulled (mặc định bật) vẫn cull từng instance
			mesh.frustumCulled = false
			mesh.castShadow = true
			mesh.receiveShadow = true
			mesh.name = node.name
			this.object.add(mesh)

			// BatchedMesh đã chép dữ liệu đỉnh, geometry gốc không cần nữa
			geometry.dispose()
			this.#materials.add(material)
			this.#parts.push({
				mesh,
				geometryId,
				local: new THREE.Matrix4().multiplyMatrices(toRoot, node.matrixWorld),
			})
		})
	}

	get count() {
		return this.#count
	}

	get meshes() {
		return this.#parts.map((p) => p.mesh)
	}

	// matrix: vị trí của gốc model trong thế giới. Trả về id để xoá sau này
	add(matrix: THREE.Matrix4) {
		let id = -1
		for (const part of this.#parts) {
			const mesh = part.mesh
			if (this.#count >= mesh.maxInstanceCount) mesh.setInstanceCount(mesh.maxInstanceCount * 2)
			const partId = mesh.addInstance(part.geometryId)
			if (id >= 0 && partId !== id) throw new Error('BatchedAsset: id giữa các mesh con lệch nhau')
			id = partId
			mesh.setMatrixAt(partId, _matrix.multiplyMatrices(matrix, part.local))
		}
		this.#count++
		return id
	}

	remove(id: number) {
		for (const part of this.#parts) part.mesh.deleteInstance(id)
		this.#count--
	}

	dispose() {
		this.object.removeFromParent()
		for (const part of this.#parts) part.mesh.dispose()
		for (const material of this.#materials) {
			for (const value of Object.values(material)) {
				if (value instanceof THREE.Texture) {
					if (value.source.data instanceof ImageBitmap) value.source.data.close()
					value.dispose()
				}
			}
			material.dispose()
		}
		this.#parts = []
		this.#materials.clear()
	}
}
