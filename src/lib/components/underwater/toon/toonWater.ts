// Toon water surface. Same grid, same wave function and same per-pixel waterline test as the realistic material
// (water/ocean/waterMaterial.js); only the shading differs:
//   camera in air:   water colour in three flat bands by water thickness over the refracted scene, two-step
//                    Fresnel towards the flat sky, hard sun sparkles, hard-edged crest foam and a white foam line
//                    where the surface meets an object.
//   camera in water: Snell's window as a flat disc of sky with a bright rim, flat deep-water colour outside it.
// Colours are albedo-like and multiplied by the scene's light level, so both styles expose alike.
import * as THREE from 'three/webgpu'
import {
	Fn,
	If,
	PI,
	abs,
	cameraPosition,
	cameraViewMatrix,
	clamp,
	dot,
	float,
	ivec2,
	length,
	max,
	mix,
	mx_noise_float,
	normalize,
	positionWorld,
	pow,
	reflect,
	refract,
	saturate,
	screenCoordinate,
	screenUV,
	smoothstep,
	texture,
	uniform,
	vec2,
	vec3,
	vec4,
} from 'three/tsl'
import { waterVertex } from '../water/ocean/waterMaterial.js'
import { toonSkyColor, toonSun } from './toonSky'
import type { Node as TslNode, OceanNodes, Texture } from './types'

const SHALLOW = vec3(0.3, 0.9, 0.8)
const MID = vec3(0.07, 0.56, 0.78)
const DEEP = vec3(0.03, 0.27, 0.62)
const FOAM = vec3(1, 1, 1)
/** path lengths through the water (m) where the colour steps to the next band */
const BAND_1 = 1.6
const BAND_2 = 4.5
const N_WATER = 1.333

export function makeToonWaterMaterial(
	O: OceanNodes,
	params: { refractStrength: number },
	backdrop: Texture,
	nearS: Texture
) {
	const U = O.U
	const mat = new THREE.MeshBasicNodeMaterial({
		side: THREE.FrontSide,
		transparent: true,
		depthWrite: true,
	})
	const backdropTex = texture(backdrop)
	const nearSTex = texture(nearS)
	// same uniform names as the realistic material, so the app can drive either one
	const W = {
		roughness: uniform(0),
		sss: uniform(0),
		refractStrength: uniform(params.refractStrength),
	}

	const { positionNode, vParam, vDxz }: Record<string, TslNode> = waterVertex(O)
	mat.positionNode = positionNode

	mat.outputNode = Fn(() => {
		const P = positionWorld
		const toCam = cameraPosition.sub(P)
		const dist = length(toCam)
		const V = toCam.div(dist).toVar()
		const { S, F } = O.surface(vParam, smoothstep(4, 1.5, dist))
		const Nw = O.normalFrom(S, vDxz).toVar()
		const out = vec3(0).toVar()

		// radiance of a white diffuse surface under this sun and sky
		const light = U.sunColor.mul(max(U.sunDir.y, 0.1)).div(PI).add(U.ambient).toVar()
		const fragViewZ = cameraViewMatrix.mul(vec4(P, 1)).z.negate()

		// crest foam from the Jacobian, broken up by noise and cut to a hard edge
		const foamN = mx_noise_float(vec3(vParam.mul(1.7), U.time.mul(0.05)))
			.mul(0.5)
			.add(0.5)
		const crest = smoothstep(0.4, 0.46, F.x.mul(U.foamStrength).mul(foamN.mul(1.6))).toVar()

		// the camera's medium at this pixel, from the same near-plane test as every other pass
		const camAbove = nearSTex.load(ivec2(screenCoordinate.xy)).x.greaterThanEqual(0)
		If(camAbove, () => {
			// ================= camera above water =================
			const N = Nw
			const cosi = abs(dot(N, V)).max(1e-3)
			// refraction: bounded screen-space offset, as in the realistic material
			const thick0 = clamp(backdropTex.sample(screenUV).a.sub(fragViewZ), 0, 8)
			const Nv = cameraViewMatrix.mul(vec4(N, 0)).xyz
			const uvR = screenUV
				.add(
					vec2(Nv.x, Nv.y.negate())
						.mul(W.refractStrength.mul(0.05))
						.mul(saturate(thick0.div(2.5)))
						.div(max(fragViewZ.mul(0.15), 1))
				)
				.toVar()
			const bdR = backdropTex.sample(uvR).toVar()
			// anything in front of the surface at the refracted uv -> fall back to the straight sample
			If(bdR.a.lessThan(fragViewZ), () => {
				bdR.assign(backdropTex.sample(screenUV))
			})
			const thick = clamp(bdR.a.sub(fragViewZ), 0, 400)
			const T = refract(V.negate(), N, float(1 / N_WATER))
			const pathLen = thick.div(max(abs(dot(T, U.camFwd)), 0.15)).min(300)

			// three flat bands by path length through the water; the seabed shows through the shallow ones
			const b1 = smoothstep(BAND_1, BAND_1 * 1.04, pathLen)
			const b2 = smoothstep(BAND_2, BAND_2 * 1.04, pathLen)
			const tint = mix(mix(SHALLOW, MID, b1), DEEP, b2)
			const cover = mix(mix(float(0.3), float(0.62), b1), float(0.86), b2)
			const body = mix(bdR.rgb.mul(mix(vec3(1), tint, 0.6)), tint.mul(light), cover)

			// two-step Fresnel towards the flat sky
			const fresnel = pow(float(1).sub(cosi), 5).mul(0.98).add(0.02)
			const mirror = smoothstep(0.1, 0.12, fresnel)
				.mul(0.3)
				.add(smoothstep(0.42, 0.45, fresnel).mul(0.4))
			const R = reflect(V.negate(), N).toVar()
			R.y.assign(abs(R.y))
			const water = mix(body, toonSkyColor(R, U), mirror).toVar()

			// sun sparkles: a hard threshold on the half vector
			const H = normalize(U.sunDir.add(V))
			const sparkle = smoothstep(0.9965, 0.9975, dot(N, H))
			water.addAssign(FOAM.mul(light).mul(sparkle.mul(2.5)))

			// white line where the surface meets an object or the bottom
			const contact = smoothstep(0.07, 0.05, thick0.sub(foamN.mul(0.05)))
			out.assign(mix(water, FOAM.mul(light), max(crest, contact)))
		}).Else(() => {
			// ================= camera below water, looking up at the surface =================
			const N = Nw.negate() // into the water
			const cosi = abs(dot(N, V)).max(1e-3)
			// Snell: a refracted ray exists while k > 0 (inside the 48.6 degree window)
			const k = float(1).sub(float(N_WATER * N_WATER).mul(float(1).sub(cosi.mul(cosi))))
			const inside = smoothstep(0.0, 0.02, k)
			const rim = inside.mul(smoothstep(0.12, 0.09, k))
			const T = refract(V.negate(), N, float(N_WATER))
			const sky = toonSkyColor(T, U).add(toonSun(T, U))
			// outside the window: the water body's own light along a fixed downward ray, so it is one flat colour
			// that still matches the underwater fog
			const depth0 = max(U.seaLevel.sub(P.y), 0)
			const deep = O.waterSegment(depth0, float(-0.1), float(200), float(0.55)).inscatter
			const surface = mix(deep, sky, inside).add(vec3(0.75, 1, 0.95).mul(light).mul(rim.mul(0.5)))
			out.assign(mix(surface, FOAM.mul(light).mul(0.55), crest.mul(0.7)))
		})
		// keep it finite in the half-float target (Inf/NaN would smear through the bloom pyramid)
		return vec4(clamp(out, vec3(0), vec3(20000)), 1)
	})()

	const back = mat.clone()
	back.side = THREE.BackSide
	return {
		material: mat,
		backMaterial: back,
		uniforms: W,
		setBackdrop: (t: Texture) => {
			backdropTex.value = t
		},
		setNearS: (t: Texture) => {
			nearSTex.value = t
		},
	}
}
