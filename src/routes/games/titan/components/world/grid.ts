import * as THREE from 'three'

/**
 * Lưới vuông nằm ngang, dày ở giữa và thưa dần ra mép (toạ độ = half·u·(0.3 + 0.7u²)),
 * để vùng quanh hồ đủ chi tiết mà không tốn tam giác cho vùng xa chìm trong sương.
 */
export function createWarpedGrid(
	half: number,
	segments: number,
	heightAt: (x: number, z: number, index: number) => number
) {
	const row = segments + 1
	const axis = new Float32Array(row)
	for (let i = 0; i < row; i++) {
		const u = -1 + (2 * i) / segments
		axis[i] = half * u * (0.3 + 0.7 * u * u)
	}

	const positions = new Float32Array(row * row * 3)
	for (let j = 0; j < row; j++)
		for (let i = 0; i < row; i++) {
			const index = j * row + i
			positions[index * 3] = axis[i]
			positions[index * 3 + 1] = heightAt(axis[i], axis[j], index)
			positions[index * 3 + 2] = axis[j]
		}

	const indices = new Uint32Array(segments * segments * 6)
	let n = 0
	for (let j = 0; j < segments; j++)
		for (let i = 0; i < segments; i++) {
			const a = j * row + i,
				b = a + 1,
				c = a + row,
				d = c + 1
			// ngược chiều kim đồng hồ khi nhìn từ trên xuống -> pháp tuyến hướng lên
			indices.set([a, c, b, b, c, d], n)
			n += 6
		}

	const geometry = new THREE.BufferGeometry()
	geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
	geometry.setIndex(new THREE.BufferAttribute(indices, 1))
	return geometry
}
