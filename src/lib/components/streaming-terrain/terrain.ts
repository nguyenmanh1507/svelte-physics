import * as THREE from 'three'
import { noise2 } from './noise'
import type { StreamingParams } from './params'
import { tileCenter, type TileCoord } from './tile-grid'

export type TerrainParams = Pick<StreamingParams, 'terrainFrequency' | 'terrainHeight'>

// Độ cao mặt đất (m) tại toạ độ thế giới (x, z): hai octave noise.
// Mặt đất, vật thể rải trên ô và nhân vật đều đọc hàm này nên luôn khớp nhau.
export function heightAt(x: number, z: number, p: TerrainParams) {
	const f = p.terrainFrequency
	const n = noise2(x * f, z * f) + 0.5 * noise2(x * f * 2 + 17.3, z * f * 2 - 4.1)
	return (n / 1.5) * p.terrainHeight
}

const NORMAL_EPS = 0.05 // m, bước sai phân để tính pháp tuyến

// Pháp tuyến tại (x, z) bằng sai phân trung tâm của heightAt
export function normalAt(x: number, z: number, p: TerrainParams, target = new THREE.Vector3()) {
	const dx = heightAt(x + NORMAL_EPS, z, p) - heightAt(x - NORMAL_EPS, z, p)
	const dz = heightAt(x, z + NORMAL_EPS, p) - heightAt(x, z - NORMAL_EPS, p)
	return target.set(-dx, 2 * NORMAL_EPS, -dz).normalize()
}

// Lưới mặt đất của một ô, toạ độ đỉnh tương đối với tâm ô (mesh đặt tại tâm ô).
// Độ cao và pháp tuyến lấy theo toạ độ thế giới, không dùng computeVertexNormals():
// đỉnh trên mép chung của hai ô kề nhau có cùng pháp tuyến nên không lộ đường nối ánh sáng.
export function createGroundGeometry(
	coord: TileCoord,
	p: TerrainParams & Pick<StreamingParams, 'tileSize' | 'tileResolution'>
) {
	const geometry = new THREE.PlaneGeometry(
		p.tileSize,
		p.tileSize,
		p.tileResolution,
		p.tileResolution
	)
	geometry.rotateX(-Math.PI / 2)

	const center = tileCenter(coord, p.tileSize)
	const position = geometry.attributes.position as THREE.BufferAttribute
	const normal = geometry.attributes.normal as THREE.BufferAttribute
	const n = new THREE.Vector3()
	for (let i = 0; i < position.count; i++) {
		const x = center.x + position.getX(i)
		const z = center.z + position.getZ(i)
		position.setY(i, heightAt(x, z, p))
		normalAt(x, z, p, n)
		normal.setXYZ(i, n.x, n.y, n.z)
	}
	geometry.computeBoundingBox()
	geometry.computeBoundingSphere()
	return geometry
}
