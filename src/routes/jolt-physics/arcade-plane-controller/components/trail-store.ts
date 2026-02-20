import * as THREE from 'three'

/** Local-space position of the trail emit point (plane tail). */
const TAIL_LOCAL = new THREE.Vector3(0, 0, 1.15)
const LEFT_WING_EDGE_LOCAL = new THREE.Vector3(-1.2, 0.03, 0)
const RIGHT_WING_EDGE_LOCAL = new THREE.Vector3(1.2, 0.03, 0)

/**
 * Computes the world-space position of the plane's tail given position and rotation.
 */
export function getTailWorldPosition(
	position: THREE.Vector3,
	quaternion: THREE.Quaternion,
	out: THREE.Vector3 = new THREE.Vector3()
): THREE.Vector3 {
	return out.copy(TAIL_LOCAL).applyQuaternion(quaternion).add(position)
}

/**
 * Computes the world-space position of both wing edge emit points.
 */
export function getWingEdgeWorldPositions(
	position: THREE.Vector3,
	quaternion: THREE.Quaternion,
	outLeft: THREE.Vector3 = new THREE.Vector3(),
	outRight: THREE.Vector3 = new THREE.Vector3()
): { left: THREE.Vector3; right: THREE.Vector3 } {
	outLeft.copy(LEFT_WING_EDGE_LOCAL).applyQuaternion(quaternion).add(position)
	outRight.copy(RIGHT_WING_EDGE_LOCAL).applyQuaternion(quaternion).add(position)
	return { left: outLeft, right: outRight }
}

/**
 * Computes trail emit points from a rendered plane group world transform.
 * This includes extra visual rotations (like banking) applied on the group.
 */
export function getTrailWorldPositionsFromGroup(
	group: THREE.Object3D,
	outTail: THREE.Vector3 = new THREE.Vector3(),
	outLeft: THREE.Vector3 = new THREE.Vector3(),
	outRight: THREE.Vector3 = new THREE.Vector3()
): { tail: THREE.Vector3; left: THREE.Vector3; right: THREE.Vector3 } {
	group.updateWorldMatrix(true, false)
	outTail.copy(TAIL_LOCAL).applyMatrix4(group.matrixWorld)
	outLeft.copy(LEFT_WING_EDGE_LOCAL).applyMatrix4(group.matrixWorld)
	outRight.copy(RIGHT_WING_EDGE_LOCAL).applyMatrix4(group.matrixWorld)
	return { tail: outTail, left: outLeft, right: outRight }
}
