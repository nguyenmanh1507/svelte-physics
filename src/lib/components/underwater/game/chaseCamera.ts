// Third-person camera that trails the submarine (pure math; the app copies the result to the camera).
import type { SubState } from './submarine'

export const CHASE = {
	/** metres from the submarine */
	distance: 2.5,
	/** metres above the submarine at zero pitch */
	height: 0.2,
	/** smoothing time constant, seconds */
	tau: 0.35,
	/** the camera stays this far above the seabed */
	floorGap: 0.15,
	/** the camera looks at a point this far above the hull centre */
	lookAhead: 0.3,
}

export interface Vec3 {
	x: number
	y: number
	z: number
}

/** where the camera wants to be: behind the bow direction, rotated by the orbit angles */
export function chaseTarget(sub: SubState, orbit: { yaw: number; pitch: number }): Vec3 {
	const yaw = sub.yaw + orbit.yaw
	const horizontal = Math.cos(orbit.pitch) * CHASE.distance
	return {
		x: sub.x - Math.sin(yaw) * horizontal,
		y: sub.y + CHASE.height + Math.sin(orbit.pitch) * CHASE.distance,
		z: sub.z - Math.cos(yaw) * horizontal,
	}
}

export function stepChase(
	current: Vec3,
	target: Vec3,
	floorAt: (x: number, z: number) => number,
	dt: number
): Vec3 {
	const blend = 1 - Math.exp(-dt / CHASE.tau)
	const x = current.x + (target.x - current.x) * blend
	const z = current.z + (target.z - current.z) * blend
	const y = current.y + (target.y - current.y) * blend
	return { x, y: Math.max(y, floorAt(x, z) + CHASE.floorGap), z }
}
