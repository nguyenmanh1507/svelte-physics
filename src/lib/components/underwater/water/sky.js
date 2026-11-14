// @ts-nocheck
// Ported from Minamo src/scene/world.js (loadSky): HDRI sky with the sun cut out into a matching directional light.
import * as THREE from 'three/webgpu'
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js'

const ASSETS = '/underwater/'
// the sky EXR stores radiance / HDRI_SCALE: the sun is brighter than half floats allow (tools/hdri_to_exr.py)
const HDRI_SCALE = 2

// ---------------------------------------------------------------- sky + sun
export async function loadSky(name) {
	const loader = new EXRLoader().setDataType(THREE.FloatType)
	const tex = await loader.loadAsync(`${ASSETS}hdri/${name}.exr`)
	const { width: W, height: H, data } = tex.image
	// EXRLoader returns the bottom row first: flip to top-first (as HDRLoader does, flipY = true) and unscale
	const row = W * 4,
		tmp = new Float32Array(row)
	for (let y = 0; y < H / 2; y++) {
		const a = y * row,
			b = (H - 1 - y) * row
		tmp.set(data.subarray(a, a + row))
		data.copyWithin(a, b, b + row)
		data.set(tmp, b)
	}
	for (let i = 0; i < data.length; i++) data[i] *= HDRI_SCALE
	tex.flipY = true
	// find the sun: brightest blob, integrate its radiance * solid angle -> irradiance, then clamp it out
	let maxL = 0
	for (let i = 0; i < W * H; i++)
		maxL = Math.max(
			maxL,
			data[i * 4] * 0.2126 + data[i * 4 + 1] * 0.7152 + data[i * 4 + 2] * 0.0722
		)
	const thr = Math.max(maxL * 0.02, 50)
	const E = [0, 0, 0],
		dir = new THREE.Vector3()
	const skyIrr = [0, 0, 0]
	const lums = []
	for (let y = 0; y < H; y++) {
		const theta = ((y + 0.5) / H) * Math.PI // from +Y
		const dOmega = (Math.PI / H) * ((2 * Math.PI) / W) * Math.sin(theta)
		for (let x = 0; x < W; x++) {
			const i = (y * W + x) * 4
			const l = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722
			// three.js equirect: u = atan(dir.z, dir.x) / 2pi + 0.5, v = asin(dir.y)/pi + 0.5 (flipY)
			const phi = ((x + 0.5) / W - 0.5) * 2 * Math.PI
			const dy = Math.cos(theta),
				r = Math.sin(theta)
			const dx = Math.cos(phi) * r,
				dz = Math.sin(phi) * r
			if (l > thr) {
				for (let k = 0; k < 3; k++) E[k] += data[i + k] * dOmega
				dir.x += dx * l * dOmega
				dir.y += dy * l * dOmega
				dir.z += dz * l * dOmega
				lums.push(i)
			}
		}
	}
	dir.normalize()
	// replace the sun pixels with the surrounding sky level
	const ring = []
	for (let y = 0; y < H; y++)
		for (let x = 0; x < W; x++) {
			const i = (y * W + x) * 4
			const l = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722
			if (l > thr * 0.05 && l <= thr) ring.push(i)
		}
	const fill = [0, 0, 0]
	for (const i of ring) for (let k = 0; k < 3; k++) fill[k] += data[i + k] / ring.length
	for (const i of lums) for (let k = 0; k < 3; k++) data[i + k] = fill[k]
	// sky irradiance on an up-facing surface (for the underwater ambient)
	for (let y = 0; y < H / 2; y++) {
		const theta = ((y + 0.5) / H) * Math.PI
		const dOmega = (Math.PI / H) * ((2 * Math.PI) / W) * Math.sin(theta)
		for (let x = 0; x < W; x++) {
			const i = (y * W + x) * 4
			for (let k = 0; k < 3; k++) skyIrr[k] += data[i + k] * Math.cos(theta) * dOmega
		}
	}
	tex.needsUpdate = true
	tex.mapping = THREE.EquirectangularReflectionMapping
	tex.colorSpace = THREE.LinearSRGBColorSpace
	const sunE = new THREE.Color(E[0], E[1], E[2])
	const ambient = new THREE.Color(skyIrr[0] / Math.PI, skyIrr[1] / Math.PI, skyIrr[2] / Math.PI)
	// the equirect -> direction convention of three.js flips x: verify via equirectUV: u = atan(z, x) / (2pi) + 0.5
	return { texture: tex, sun: { dir, color: sunE, ambient, baseColor: sunE.clone() } }
}
