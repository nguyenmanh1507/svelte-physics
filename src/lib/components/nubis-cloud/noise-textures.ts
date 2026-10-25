// GPU generation of the Nubis lookup textures (SIGGRAPH 2015 / GPU Pro 7):
//
//  • shape   128³ RGBA  R = Perlin-Worley, GBA = inverted Worley fBm at increasing frequency
//  • detail   32³ RGB   Worley fBm at 3 increasing frequencies (erodes cloud edges)
//  • curl    128² RG    non-divergent 2D curl noise (distorts the detail lookup → turbulence)
//  • weather 512² RGBA  R = coverage, G = precipitation, B = cloud type, A = column height ("The Cloud Map")
//
// Everything is written by compute shaders into storage textures, so (re)generation is instant.
import * as THREE from 'three/webgpu'
import {
	Fn,
	float,
	instanceIndex,
	int,
	ivec2,
	ivec3,
	textureStore,
	uint,
	uniform,
	vec2,
	vec3,
	wgslFn,
} from 'three/tsl'
import { COMMON_INCLUDES } from './wgsl/common'

export const SHAPE_SIZE = 128
export const DETAIL_SIZE = 32
export const CURL_SIZE = 128
export const WEATHER_SIZE = 512

function makeStorage3D(size: number) {
	const tex = new THREE.Storage3DTexture(size, size, size)
	tex.format = THREE.RGBAFormat
	tex.type = THREE.UnsignedByteType
	tex.wrapS = tex.wrapT = tex.wrapR = THREE.RepeatWrapping
	tex.minFilter = tex.magFilter = THREE.LinearFilter
	tex.generateMipmaps = false
	return tex
}

function makeStorage2D(size: number) {
	const tex = new THREE.StorageTexture(size, size)
	tex.format = THREE.RGBAFormat
	tex.type = THREE.UnsignedByteType
	tex.wrapS = tex.wrapT = THREE.RepeatWrapping
	tex.minFilter = tex.magFilter = THREE.LinearFilter
	tex.generateMipmaps = false
	return tex
}

// Base shape: Perlin-Worley. "Subtract the web-like shapes of Worley from the low
// density regions of Perlin to introduce round shapes there" (Nubis in a Nutshell, slide 10).
const shapeNoiseFn = wgslFn(
	/* wgsl */ `
fn shapeNoise( p : vec3<f32> ) -> vec4<f32> {
	let perlin = perlinFbm( p, 4.0, 7 );
	let worleyLow = worleyFbmInv( p, 4.0 );
	// dilate Perlin with inverted Worley  (remap(perlin, 0, 1, worley, 1))
	let perlinWorley = remap( perlin, 0.0, 1.0, worleyLow, 1.0 );
	let w1 = worleyFbmInv( p, 8.0 );
	let w2 = worleyFbmInv( p, 16.0 );
	let w3 = worleyFbmInv( p, 32.0 );
	return vec4<f32>( perlinWorley, w1, w2, w3 );
}
`,
	COMMON_INCLUDES
)

const detailNoiseFn = wgslFn(
	/* wgsl */ `
fn detailNoise( p : vec3<f32> ) -> vec4<f32> {
	let w1 = worleyFbmInv( p, 4.0 );
	let w2 = worleyFbmInv( p, 8.0 );
	let w3 = worleyFbmInv( p, 16.0 );
	return vec4<f32>( w1, w2, w3, 1.0 );
}
`,
	COMMON_INCLUDES
)

// 2D curl noise = (dψ/dy, -dψ/dx) of a Perlin potential ψ → divergence free.
const curlNoiseFn = wgslFn(
	/* wgsl */ `
fn curlNoise( uv : vec2<f32> ) -> vec4<f32> {
	let e = 1.0 / 128.0;
	let f = 4.0;
	let px = perlinFbm( vec3<f32>( uv.x + e, uv.y, 0.37 ), f, 3 ) - perlinFbm( vec3<f32>( uv.x - e, uv.y, 0.37 ), f, 3 );
	let py = perlinFbm( vec3<f32>( uv.x, uv.y + e, 0.37 ), f, 3 ) - perlinFbm( vec3<f32>( uv.x, uv.y - e, 0.37 ), f, 3 );
	let curl = vec2<f32>( py, -px ) / ( 2.0 * e );
	let n = clamp( curl * 0.08, vec2<f32>( -1.0 ), vec2<f32>( 1.0 ) );
	return vec4<f32>( n * 0.5 + 0.5, 0.5, 1.0 );
}
`,
	COMMON_INCLUDES
)

// Procedural cloud map. In Horizon these are hand-painted / procedurally mixed 2D
// probability fields; here we derive them from low-frequency Perlin fBm with GUI bias.
const weatherFn = wgslFn(
	/* wgsl */ `
fn weatherNoise( uv : vec2<f32>, coverageBias : f32, typeBias : f32, precipBias : f32, seed : f32 ) -> vec4<f32> {
	let p = vec3<f32>( uv, seed );
	// large systems (freq 6 → ~10 km blobs on a 60 km map) + smaller variation
	let c0 = perlinFbm( p, 6.0, 4 );
	let c1 = perlinFbm( p + vec3<f32>( 0.0, 0.0, 7.31 ), 16.0, 3 );
	var coverage = remap( c0 * 0.75 + c1 * 0.25, 0.42, 0.92, 0.0, 1.0 );
	// coverageBias 0.5 = fair weather (roughly half the sky), 1.0 = overcast
	coverage = clamp( coverage + ( coverageBias - 0.5 ) * 1.5, 0.0, 1.0 );
	var ctype = perlinFbm( p + vec3<f32>( 0.0, 0.0, 19.7 ), 2.0, 4 );
	ctype = clamp( remap( ctype, 0.3, 0.7, 0.0, 1.0 ) + ( typeBias - 0.5 ) * 2.0, 0.0, 1.0 );
	var precip = perlinFbm( p + vec3<f32>( 0.0, 0.0, 41.2 ), 2.0, 3 );
	precip = clamp( remap( precip, 0.5, 0.8, 0.0, 1.0 ) + ( precipBias - 0.5 ) * 2.0, 0.0, 1.0 );
	// precipitation pushes towards cumulonimbus-like coverage (SIGGRAPH 2015)
	coverage = max( coverage, precip * 0.7 );
	// per-column cloud height (Nubis Evolved): varies the top / base of each column, ~2.5 km features
	let height = remap( perlinFbm( p + vec3<f32>( 0.0, 0.0, 63.1 ), 12.0, 3 ), 0.3, 0.7, 0.0, 1.0 );
	return vec4<f32>( coverage, precip, ctype, clamp( height, 0.0, 1.0 ) );
}
`,
	COMMON_INCLUDES
)

type NoiseFn = typeof shapeNoiseFn

export class NubisTextures {
	readonly shape = makeStorage3D(SHAPE_SIZE)
	readonly detail = makeStorage3D(DETAIL_SIZE)
	readonly curl = makeStorage2D(CURL_SIZE)
	readonly weather = makeStorage2D(WEATHER_SIZE) // tileable → the cloud map repeats seamlessly

	readonly weatherParams = {
		coverageBias: uniform(0.5),
		typeBias: uniform(0.5),
		precipBias: uniform(0.2),
		seed: uniform(0.0),
	}

	#renderer: THREE.WebGPURenderer
	#computeShape: THREE.ComputeNode
	#computeDetail: THREE.ComputeNode
	#computeCurl: THREE.ComputeNode
	#computeWeather: THREE.ComputeNode

	constructor(renderer: THREE.WebGPURenderer) {
		this.#renderer = renderer

		const compute3D = (tex: THREE.Storage3DTexture, size: number, noiseFn: NoiseFn) =>
			Fn(() => {
				const i = instanceIndex
				const s = uint(size)
				const x = i.mod(s)
				const y = i.div(s).mod(s)
				const z = i.div(uint(size * size))
				const p = vec3(float(x), float(y), float(z)).add(0.5).div(float(size))
				textureStore(tex, ivec3(int(x), int(y), int(z)), noiseFn({ p })).toWriteOnly()
			})().compute(size * size * size)

		const compute2D = (
			tex: THREE.StorageTexture,
			size: number,
			value: (uv: THREE.Node) => THREE.Node
		) =>
			Fn(() => {
				const i = instanceIndex
				const s = uint(size)
				const x = i.mod(s)
				const y = i.div(s)
				const uv = vec2(float(x), float(y)).add(0.5).div(float(size))
				textureStore(tex, ivec2(int(x), int(y)), value(uv)).toWriteOnly()
			})().compute(size * size)

		this.#computeShape = compute3D(this.shape, SHAPE_SIZE, shapeNoiseFn)
		this.#computeDetail = compute3D(this.detail, DETAIL_SIZE, detailNoiseFn)
		this.#computeCurl = compute2D(this.curl, CURL_SIZE, (uv) => curlNoiseFn({ uv }))
		const wp = this.weatherParams
		this.#computeWeather = compute2D(this.weather, WEATHER_SIZE, (uv) =>
			weatherFn({
				uv,
				coverageBias: wp.coverageBias,
				typeBias: wp.typeBias,
				precipBias: wp.precipBias,
				seed: wp.seed,
			})
		)
	}

	// trả về thời gian sinh (ms)
	async generateAll() {
		const t0 = performance.now()
		await this.#renderer.computeAsync(this.#computeShape)
		await this.#renderer.computeAsync(this.#computeDetail)
		await this.#renderer.computeAsync(this.#computeCurl)
		await this.#renderer.computeAsync(this.#computeWeather)
		return performance.now() - t0
	}

	async regenerateWeather() {
		await this.#renderer.computeAsync(this.#computeWeather)
	}

	dispose() {
		this.shape.dispose()
		this.detail.dispose()
		this.curl.dispose()
		this.weather.dispose()
		for (const node of [
			this.#computeShape,
			this.#computeDetail,
			this.#computeCurl,
			this.#computeWeather,
		])
			node.dispose()
	}
}
