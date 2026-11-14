// Toon lighting for opaque objects under (and above) water. Same hooks as water/underwaterize.js, same shared
// textures, different look: the sun comes through MeshToonNodeMaterial's two-step ramp, cast shadows get a hard
// edge and the caustic texture is thresholded into crisp bright lines.
import * as THREE from 'three/webgpu'
import {
	Fn,
	dot,
	float,
	materialColor,
	max,
	mix,
	normalView,
	positionViewDirection,
	positionWorld,
	smoothstep,
	vec3,
} from 'three/tsl'
import type { Material, Node, OceanNodes } from './types'

export interface ToonOptions {
	/** albedo node, defaults to the material colour */
	colorNode?: Node
	/** strength of the hard rim light on silhouettes (0 = none) */
	rim?: number
	/**
	 * false = ignore cast shadows on this material. Small curved objects show shadow-map acne along the terminator,
	 * which the hard toon edge turns into jagged black blobs; the two-step ramp already shades their unlit side.
	 */
	shadows?: boolean
}

/** caustic focusing above this reads as a bright line, below as flat light */
const CAUSTIC_EDGE = 1.22
const CAUSTIC_BASE = 0.82
const CAUSTIC_LINE = 2.1

export function makeToonMaterial(O: OceanNodes, color: number, opts: ToonOptions = {}) {
	return toonUnderwaterize(new THREE.MeshToonNodeMaterial({ color }), O, opts)
}

export function toonUnderwaterize(mat: Material, O: OceanNodes, opts: ToonOptions = {}) {
	const U = O.U
	const p = positionWorld
	// instantaneous water height above this point (one inverse-displacement step is plenty for lighting)
	const D0 = O.displacementFast(p.xz)
	const waterH = O.displacementFast(p.xz.sub(D0.xz)).y.add(U.seaLevel)
	const depth = waterH.sub(p.y)
	const under = smoothstep(-0.02, 0.06, depth)
	const Tamb = O.ambientTransmittance(depth)
	const albedo = (opts.colorNode ?? materialColor).mul(mix(vec3(1), Tamb, under))
	mat.colorNode = albedo

	// direct sun below the water: attenuated, with the caustics reduced to two levels
	const sunFactor = Fn(() => {
		const d = max(depth, 0)
		const ratio = O.sunTransmittance(d)
			.div(max(Tamb, vec3(1e-4)))
			.mul(0.97)
		const focus = dot(O.caustic(p, d), vec3(0.2126, 0.7152, 0.0722))
		const line = smoothstep(CAUSTIC_EDGE, CAUSTIC_EDGE + 0.06, focus)
		return mix(vec3(1), ratio.mul(mix(float(CAUSTIC_BASE), float(CAUSTIC_LINE), line)), under)
	})()
	mat.receivedShadowNode =
		opts.shadows === false
			? () => sunFactor
			: // three calls the hook with the shadow factor, @types/three declares it without arguments
				(((shadow: Node) =>
					smoothstep(0.3, 0.7, shadow).mul(sunFactor)) as unknown as Material['receivedShadowNode'])

	if (opts.rim) {
		// hard rim light on the silhouette, in scene light units so it follows the exposure
		const facing = dot(normalView, positionViewDirection)
		const rim = smoothstep(0.34, 0.3, facing)
		mat.emissiveNode = albedo.mul(U.ambient).mul(rim.mul(opts.rim))
	}
	return mat
}
