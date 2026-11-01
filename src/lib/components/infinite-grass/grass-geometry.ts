import * as THREE from 'three'

// Số đỉnh của một mặt lá: mỗi mốc độ cao có 2 đỉnh (trái, phải)
export function bladeVertexCount(segments: number) {
	return (segments + 1) * 2
}

// Index cho một lá cỏ 2 mặt. Đỉnh [0, V) là mặt trước, [V, 2V) là mặt sau (đảo chiều quấn).
// Mỗi đoạn = 2 tam giác mỗi mặt = 12 index.
export function bladeIndices(segments: number) {
	const vertices = bladeVertexCount(segments)
	const indices = new Array<number>(segments * 12)

	for (let i = 0; i < segments; ++i) {
		const vi = i * 2
		indices[i * 12 + 0] = vi + 0
		indices[i * 12 + 1] = vi + 1
		indices[i * 12 + 2] = vi + 2

		indices[i * 12 + 3] = vi + 2
		indices[i * 12 + 4] = vi + 1
		indices[i * 12 + 5] = vi + 3

		const fi = vertices + vi
		indices[i * 12 + 6] = fi + 2
		indices[i * 12 + 7] = fi + 1
		indices[i * 12 + 8] = fi + 0

		indices[i * 12 + 9] = fi + 3
		indices[i * 12 + 10] = fi + 1
		indices[i * 12 + 11] = fi + 2
	}
	return indices
}

// Geometry không có attribute nào: shader dựng đỉnh từ gl_VertexID / gl_InstanceID.
export function createGrassGeometry(segments: number, bladeCount: number, patchSize: number) {
	const geometry = new THREE.InstancedBufferGeometry()
	geometry.setIndex(bladeIndices(segments))
	geometry.instanceCount = bladeCount
	setGrassBounds(geometry, patchSize)
	return geometry
}

// three không tự tính được bounds khi không có position -> đặt tay để frustum culling đúng
export function setGrassBounds(geometry: THREE.BufferGeometry, patchSize: number) {
	geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1 + patchSize * 2)
}
