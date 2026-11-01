import * as THREE from 'three'

// Uniform dùng chung giữa các material: cùng một object nên chỉ cần ghi một lần.
// Thêm một vật thể mới vào scene chỉ cần spread các uniform nó cần vào material của nó.
export function createSharedUniforms() {
	return {
		resolution: { value: new THREE.Vector2(1, 1) }, // kích thước drawing buffer (px)
		terrainParams: { value: new THREE.Vector2() }, // x = tần số, y = biên độ (terrain.glsl)
	}
}

export type SharedUniforms = ReturnType<typeof createSharedUniforms>
