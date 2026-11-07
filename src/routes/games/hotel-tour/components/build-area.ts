import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { Area } from './areas'
import type { Prim } from './prims'

// Dựng một khu thành THREE.Group: gộp mọi khối cùng vật liệu thành một mesh để ít draw call.

function unitGeometry(p: Prim) {
	switch (p.shape) {
		case 'box':
			return new THREE.BoxGeometry(1, 1, 1)
		case 'cylinder':
			return new THREE.CylinderGeometry(0.5 * (p.top ?? 1), 0.5, 1, 28)
		case 'sphere':
			return new THREE.SphereGeometry(0.5, 20, 14)
	}
}

function materialKey(p: Prim) {
	return `${p.color}|${p.glass ? 'g' : ''}${p.glow ? 'e' : ''}`
}

function makeMaterial(p: Prim) {
	const color = new THREE.Color(p.color)
	if (p.glass) {
		return new THREE.MeshStandardMaterial({
			color,
			roughness: 0.05,
			transparent: true,
			opacity: 0.16,
			depthWrite: false,
		})
	}
	if (p.glow) {
		return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.2 })
	}
	return new THREE.MeshStandardMaterial({ color, roughness: 0.85 })
}

export function buildArea(area: Area) {
	const group = new THREE.Group()
	group.name = area.id
	group.position.y = area.floorY

	const buckets = new Map<string, { prim: Prim; geometries: THREE.BufferGeometry[] }>()
	const matrix = new THREE.Matrix4()
	const position = new THREE.Vector3()
	const scale = new THREE.Vector3()
	const identity = new THREE.Quaternion()

	for (const p of area.prims) {
		position.set((p.min[0] + p.max[0]) / 2, (p.min[1] + p.max[1]) / 2, (p.min[2] + p.max[2]) / 2)
		scale.set(p.max[0] - p.min[0], p.max[1] - p.min[1], p.max[2] - p.min[2])
		const geometry = unitGeometry(p).applyMatrix4(matrix.compose(position, identity, scale))
		const key = materialKey(p)
		const bucket = buckets.get(key) ?? { prim: p, geometries: [] }
		bucket.geometries.push(geometry)
		buckets.set(key, bucket)
	}

	for (const { prim, geometries } of buckets.values()) {
		const merged = mergeGeometries(geometries)
		for (const g of geometries) g.dispose()
		const mesh = new THREE.Mesh(merged, makeMaterial(prim))
		const opaque = !prim.glass && !prim.glow
		mesh.castShadow = opaque
		mesh.receiveShadow = !prim.glass
		// kính vẽ sau cùng để thấy được đồ vật phía sau
		if (prim.glass) mesh.renderOrder = 1
		group.add(mesh)
	}
	return group
}

export function disposeGroup(group: THREE.Group) {
	group.traverse((o) => {
		if (o instanceof THREE.Mesh) {
			o.geometry.dispose()
			;(o.material as THREE.Material).dispose()
		}
	})
}
