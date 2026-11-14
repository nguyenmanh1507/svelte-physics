import * as THREE from 'three'

import { createWarpedGrid } from './grid'
import { fbm, GLSL_NOISE, smooth } from './noise'
import { duneMask, groundH, LIQUID_LEVEL, shoreDistance, WORLD_HALF } from './terrain'

const SEGMENTS = 384

// "đá gốc" của Titan là băng nước, phủ một lớp bụi hữu cơ (tholin) màu cam nâu
const LOWLAND = new THREE.Color('#8d5a2c')
const HIGHLAND = new THREE.Color('#b58d5d')
const DUNE = new THREE.Color('#2e1d12') // cát hydrocarbon sẫm như bã cà phê
const LAKEBED = new THREE.Color('#4d3520')

export function createGround() {
	const row = SEGMENTS + 1
	const colors = new Float32Array(row * row * 3)
	const color = new THREE.Color()

	const geometry = createWarpedGrid(WORLD_HALF, SEGMENTS, (x, z, index) => {
		const shore = shoreDistance(x, z)
		const h = groundH(x, z, shore)

		if (shore < 0) color.copy(LAKEBED)
		else {
			const patch = fbm(x * 0.02 + 5, z * 0.02, 3)
			const t = smooth(3, 24, h) * 0.75 + (patch - 0.5) * 0.5
			color.lerpColors(LOWLAND, HIGHLAND, Math.min(1, Math.max(0, t)))
			color.lerp(DUNE, duneMask(x, z, shore) * 0.9)
			// dải đất ẩm sát mép chất lỏng (mực hồ đứng yên nên tính sẵn được)
			color.multiplyScalar(0.55 + 0.45 * smooth(0.1, 0.6, h - LIQUID_LEVEL))
		}
		color.toArray(colors, index * 3)
		return h
	})
	geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
	geometry.computeVertexNormals()

	const material = new THREE.MeshLambertMaterial({ vertexColors: true })
	// thêm hạt sần theo toạ độ thế giới để mặt đất không trơn khi camera xuống sát
	material.onBeforeCompile = (shader) => {
		shader.vertexShader = shader.vertexShader
			.replace('#include <common>', '#include <common>\nvarying vec3 vGroundPos;')
			.replace(
				'#include <begin_vertex>',
				'#include <begin_vertex>\nvGroundPos = (modelMatrix * vec4(transformed, 1.0)).xyz;'
			)
		shader.fragmentShader = shader.fragmentShader
			.replace('#include <common>', `#include <common>\nvarying vec3 vGroundPos;\n${GLSL_NOISE}`)
			.replace(
				'#include <color_fragment>',
				/* glsl */ `#include <color_fragment>
        float grain = vnoise(vGroundPos.xz * 0.7) * 0.45 + vnoise(vGroundPos.xz * 3.1) * 0.35 + vnoise(vGroundPos.xz * 13.0) * 0.2;
        diffuseColor.rgb *= 0.66 + 0.68 * grain;`
			)
	}

	return new THREE.Mesh(geometry, material)
}

/** sỏi băng nước bo tròn ven hồ, giống ảnh Huygens chụp tại điểm đáp */
export function createPebbles(rng: () => number, count = 3200) {
	const geometry = new THREE.IcosahedronGeometry(1, 1)
	// bóp méo nhẹ để viên sỏi không tròn đều; cùng vị trí -> cùng độ lệch nên không hở mặt
	const position = geometry.getAttribute('position')
	const v = new THREE.Vector3()
	for (let i = 0; i < position.count; i++) {
		v.fromBufferAttribute(position, i)
		v.multiplyScalar(0.82 + 0.36 * fbm(v.x * 1.7 + 4, v.y * 1.7 + v.z * 2.3, 2))
		position.setXYZ(i, v.x, v.y * 0.62, v.z)
	}
	geometry.computeVertexNormals()

	const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshLambertMaterial(), count)
	const matrix = new THREE.Matrix4()
	const quaternion = new THREE.Quaternion()
	const euler = new THREE.Euler()
	const scale = new THREE.Vector3()
	const color = new THREE.Color()
	const base = new THREE.Color('#b59c7c')

	let placed = 0
	for (let tries = 0; placed < count && tries < 200_000; tries++) {
		const x = (rng() - 0.5) * 560,
			z = (rng() - 0.5) * 560
		const shore = shoreDistance(x, z)
		// dày nhất ở mép nước, thưa dần vào đất liền; vài viên nằm trong vùng nông
		if (shore < -5 || shore > 70 || rng() > Math.exp(-Math.max(shore, 0) / 18)) continue

		// đa số cỡ 10-40 cm, thỉnh thoảng có tảng lớn
		const size = rng() < 0.04 ? 0.7 + rng() * 1.1 : 0.07 + rng() * rng() * 0.4
		scale.set(size * (0.8 + rng() * 0.5), size * (0.7 + rng() * 0.5), size * (0.8 + rng() * 0.5))
		quaternion.setFromEuler(euler.set(rng() * 0.5, rng() * Math.PI * 2, rng() * 0.5))
		// chôn bớt một phần xuống nền
		v.set(x, groundH(x, z, shore) + scale.y * 0.2, z)
		mesh.setMatrixAt(placed, matrix.compose(v, quaternion, scale))
		mesh.setColorAt(placed, color.copy(base).multiplyScalar(0.7 + rng() * 0.5))
		placed++
	}
	mesh.count = placed
	mesh.instanceMatrix.needsUpdate = true
	if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
	// các viên rải khắp vùng hồ, không đáng để cull theo bounding sphere của một viên
	mesh.frustumCulled = false
	return mesh
}
