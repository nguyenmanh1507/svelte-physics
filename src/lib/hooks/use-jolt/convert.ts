import type JoltType from 'jolt-physics/wasm-compat'
import * as THREE from 'three'
import type { QuatTuple, Vec3Tuple } from './types'

export const toThreeVec3 = (vector: JoltType.RVec3 | JoltType.Vec3) =>
	new THREE.Vector3(vector.GetX(), vector.GetY(), vector.GetZ())

export const toThreeQuat = (quaternion: JoltType.Quat) =>
	new THREE.Quaternion(quaternion.GetX(), quaternion.GetY(), quaternion.GetZ(), quaternion.GetW())

export const toJoltVec3 = (JoltModule: typeof JoltType, [x, y, z]: Vec3Tuple) =>
	new JoltModule.Vec3(x, y, z)

export const toJoltRVec3 = (JoltModule: typeof JoltType, [x, y, z]: Vec3Tuple) =>
	new JoltModule.RVec3(x, y, z)

export const toJoltQuat = (JoltModule: typeof JoltType, [x, y, z, w]: QuatTuple) =>
	new JoltModule.Quat(x, y, z, w)

export const getMeshPositionTuple = (mesh: THREE.Object3D): Vec3Tuple => [
	mesh.position.x,
	mesh.position.y,
	mesh.position.z,
]

export const getMeshRotationTuple = (mesh: THREE.Object3D): QuatTuple => [
	mesh.quaternion.x,
	mesh.quaternion.y,
	mesh.quaternion.z,
	mesh.quaternion.w,
]
