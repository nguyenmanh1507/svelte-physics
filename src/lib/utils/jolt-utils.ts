import Jolt from 'jolt-physics'

/**
 * Generates a random quaternion representing a rotation.
 *
 * This function creates a random axis (as a normalized Jolt.Vec3)
 * and a random angle between 0 and 2π, then constructs a quaternion
 * representing a rotation around that axis by that angle.
 * The created vector is destroyed afterwards to avoid memory leaks.
 */
export function getRandomQuat(): Jolt.Quat {
	// Create a random axis for rotation (avoiding zero vector)
	const axis = new Jolt.Vec3(0.001 + Math.random(), Math.random(), Math.random())
	// Create a random angle between 0 and 2π
	const angle = 2 * Math.PI * Math.random()
	// Construct the quaternion representing rotation
	const quat = Jolt.Quat.prototype.sRotation(axis.Normalized(), angle)
	Jolt.destroy(axis) // Clean up to prevent leaks
	return quat
}
