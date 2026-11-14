// Toon sky: a two-colour gradient with a hard-edged sun disc. Shared by the scene background, the water's sky
// reflection and Snell's window, so all three show the same sky.
import type { Node, OceanNodes } from './types'
import {
	dot,
	float,
	max,
	mix,
	normalWorldGeometry,
	normalize,
	pow,
	saturate,
	smoothstep,
	vec3,
} from 'three/tsl'

// Scene-linear colours relative to the mean sky radiance, chosen from what the AgX output pass makes of them:
// pale (white-ish) blues come out grey at mid exposure, so both ends stay saturated and the horizon is lighter by
// being brighter, not by being whiter.
const ZENITH = vec3(0.0, 0.75, 3.0)
const HORIZON = vec3(0.7, 4.2, 7.0)
/** cos of the sun disc's angular radius (about 3 degrees: toon suns are big) */
const SUN_COS = Math.cos((3 * Math.PI) / 180)

type OceanUniforms = OceanNodes['U']

/** mean sky radiance of the scene: flat sky colours scale with it so auto exposure sees the same level in both styles */
const skyLevel = (U: OceanUniforms) => dot(U.ambient, vec3(0.2126, 0.7152, 0.0722))

/** sky radiance towards `dir` (unit vector, or zero where a refracted ray does not exist) */
export function toonSkyColor(dir: Node, U: OceanUniforms): Node {
	const t = pow(saturate(dir.y), 0.45)
	return mix(HORIZON, ZENITH, t).mul(skyLevel(U))
}

/** hard-edged sun disc with a faint halo ring, to add on top of toonSkyColor */
export function toonSun(dir: Node, U: OceanUniforms): Node {
	const c = dot(dir, U.sunDir)
	const disc = smoothstep(SUN_COS - 0.0004, SUN_COS + 0.0004, c)
	const halo = smoothstep(float(SUN_COS - 0.012), float(SUN_COS - 0.011), c).mul(0.18)
	return vec3(1, 0.97, 0.85)
		.mul(skyLevel(U))
		.mul(max(disc.mul(6), halo))
}

/** node for `scene.backgroundNode` */
export function toonSkyBackground(U: OceanUniforms): Node {
	const dir = normalize(normalWorldGeometry)
	return toonSkyColor(dir, U).add(toonSun(dir, U))
}
