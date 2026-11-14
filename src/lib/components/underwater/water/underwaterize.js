// @ts-nocheck
// Ported from Minamo src/scene/world.js (underwaterize): underwater lighting for any lit node material:
//   sun  * Fresnel transmission * exp(-Kd' depth) * caustics   (through receivedShadowNode)
//   sky  * exp(-Kd depth)                                       (albedo tint)
//   wet darkening in the splash band above the instantaneous waterline.
import {
	Fn,
	float,
	vec3,
	positionWorld,
	mix,
	smoothstep,
	max,
	materialColor,
	materialRoughness,
	mx_noise_float,
} from 'three/tsl'

export function underwaterize(mat, O, opts = {}) {
	const U = O.U
	const p = positionWorld
	// instantaneous water height above this point (one inverse-displacement step is plenty for lighting)
	const D0 = O.displacementFast(p.xz)
	const waterH = O.displacementFast(p.xz.sub(D0.xz)).y.add(U.seaLevel)
	const depth = waterH.sub(p.y)
	const under = smoothstep(-0.02, 0.06, depth)
	const Tamb = O.ambientTransmittance(depth)
	// wet band above the water: darker, glossier, fades out ~0.7 m up with some noise
	const wetN = mx_noise_float(p.mul(vec3(1.3, 6, 1.3))).mul(0.25)
	const wet = smoothstep(0.75, 0.0, depth.negate().add(wetN)).mul(float(1).sub(under))
	const baseColor = opts.colorNode || materialColor
	mat.colorNode = baseColor.mul(mix(vec3(1), Tamb, under)).mul(mix(1, 0.55, wet))
	const baseRough = opts.roughnessNode || materialRoughness
	mat.roughnessNode = mix(baseRough, baseRough.mul(0.35), wet)
	// direct sun: everything below the water gets the refracted, attenuated, caustic-focused sun
	const sunFactor = Fn(() => {
		const d = max(depth, 0)
		const ratio = O.sunTransmittance(d)
			.div(max(Tamb, vec3(1e-4)))
			.mul(0.97)
		const c = O.caustic(p, d)
		return mix(vec3(1), ratio.mul(c), under)
	})()
	mat.receivedShadowNode = (shadow) => shadow.mul(sunFactor)
	return mat
}
