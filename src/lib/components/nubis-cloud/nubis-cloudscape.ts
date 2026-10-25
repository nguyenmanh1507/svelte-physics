import * as THREE from 'three/webgpu'
import { texture, texture3D, uniform, uv, wgsl, wgslFn } from 'three/tsl'
import { NubisTextures } from './noise-textures'
import {
	WEATHER_KEYS,
	defaultNubisParams,
	packUniforms,
	sunDirection,
	type NubisParams,
	type PackedUniforms,
} from './params'
import { cloudHelpersWGSL, cloudMarchFn } from './wgsl/cloud-march'
import { COMMON_INCLUDES, phaseWGSL } from './wgsl/common'
import { skyWGSL } from './wgsl/sky'

// Cloud shadows on the scene: from a scene point, 3 cheap density samples along the sun ray
// through the cloud layer -> Beer-Lambert transmittance. Same density function as the march,
// so shadows sit under the clouds and drift with the wind. Soft by design (no detail erosion).
const cloudShadowWGSL = wgsl(/* wgsl */ `
fn cloudShadowFactor(
	p : vec3<f32>, sunDir : vec3<f32>, windDir : vec3<f32>, strength : f32,
	shapeTex : texture_3d<f32>, shapeSampler : sampler,
	detailTex : texture_3d<f32>, detailSampler : sampler,
	curlTex : texture_2d<f32>, curlSampler : sampler,
	weatherTex : texture_2d<f32>, weatherSampler : sampler,
	uLayer : vec4<f32>, uScale : vec4<f32>, uShape : vec4<f32>, uProfile : vec4<f32>,
	uAnim : vec4<f32>, uLight : vec4<f32>, uLight2 : vec4<f32>
) -> f32 {
	// low sun: shadows would stretch to infinity -> fade them out at sunrise / sunset
	let sunFade = smoothstep( 0.02, 0.15, sunDir.y );
	if ( strength <= 0.0 || sunFade <= 0.0 ) { return 1.0; }
	let planetR = uLayer.z;
	let planetCenter = vec3<f32>( 0.0, -planetR, 0.0 );
	let inner = raySphere( p, sunDir, planetCenter, planetR + uLayer.x );
	let outer = raySphere( p, sunDir, planetCenter, planetR + uLayer.y );
	let t0 = max( inner.y, 0.0 );
	let t1 = outer.y;
	if ( t1 <= t0 ) { return 1.0; }
	let segLen = ( t1 - t0 ) / 3.0;
	var depth = 0.0;
	for ( var i : i32 = 0; i < 3; i++ ) {
		let sp = p + sunDir * ( t0 + segLen * ( f32( i ) + 0.5 ) );
		let hf = heightFraction( sp, planetCenter, planetR, uLayer.x, uLayer.y );
		let w = sampleWeather( weatherTex, weatherSampler, sp, uScale.x );
		depth += sampleCloudDensity( sp, w, hf, true, windDir, shapeTex, shapeSampler,
			detailTex, detailSampler, curlTex, curlSampler, uScale, uShape, uProfile, uAnim, uLight2 );
	}
	// cheap density has no erosion and overestimates -> halve the optical depth
	let transmittance = exp( -depth * uLight.x * segLen * 0.5 );
	return mix( 1.0, transmittance, strength * sunFade );
}
`)

// Composite: sky background + cloud shadows + aerial perspective + clouds (premultiplied over).
const compositeFn = wgslFn(
	/* wgsl */ `
fn composite( uv : vec2<f32>, sceneColor : vec4<f32>, sceneDepth : f32, cloudIn : vec4<f32>, cloudsOn : f32,
	camPos : vec3<f32>, camTan : vec2<f32>, camWorld : mat4x4<f32>, camNear : f32, camFar : f32,
	sunDir : vec3<f32>, sunIntensity : f32, fogDensity : f32, debugMode : f32,
	cloudShadow : f32, windDir : vec3<f32>,
	shapeTex : texture_3d<f32>, shapeSampler : sampler,
	detailTex : texture_3d<f32>, detailSampler : sampler,
	curlTex : texture_2d<f32>, curlSampler : sampler,
	weatherTex : texture_2d<f32>, weatherSampler : sampler,
	uLayer : vec4<f32>, uScale : vec4<f32>, uShape : vec4<f32>, uProfile : vec4<f32>,
	uAnim : vec4<f32>, uLight : vec4<f32>, uLight2 : vec4<f32> ) -> vec4<f32> {
	let cloud = mix( vec4<f32>( 0.0, 0.0, 0.0, 1.0 ), cloudIn, cloudsOn );
	let ndc = vec2<f32>( uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0 );
	let rd = normalize( ( camWorld * vec4<f32>( ndc * camTan, -1.0, 0.0 ) ).xyz );
	let camFwd = normalize( ( camWorld * vec4<f32>( 0.0, 0.0, -1.0, 0.0 ) ).xyz );
	var bg = skyRadiance( rd, sunDir, sunIntensity );
	if ( sceneDepth < 1.0 ) {
		let viewZ = ( camNear * camFar ) / ( ( camFar - camNear ) * sceneDepth - camFar );
		let dist = -viewZ / max( dot( rd, camFwd ), 1e-4 );
		var lit = sceneColor.rgb;
		if ( cloudsOn > 0.5 ) {
			lit *= cloudShadowFactor( camPos + rd * dist, sunDir, windDir, cloudShadow,
				shapeTex, shapeSampler, detailTex, detailSampler, curlTex, curlSampler,
				weatherTex, weatherSampler, uLayer, uScale, uShape, uProfile, uAnim, uLight, uLight2 );
		}
		let fog = 1.0 - exp( -dist * fogDensity * 2.5 );
		let haze = skyRadiance( normalize( vec3<f32>( rd.x, 0.02, rd.z ) ), sunDir, 0.0 );
		bg = mix( lit, haze, fog );
	}
	if ( debugMode == 6.0 ) { return vec4<f32>( vec3<f32>( ( 1.0 - sceneDepth ) * 20.0 ), 1.0 ); }
	// debug views: undo the sRGB output transform so raw values show up linearly
	if ( debugMode >= 1.0 ) { return vec4<f32>( pow( cloud.rgb, vec3<f32>( 2.2 ) ), 1.0 ); }
	return vec4<f32>( bg * cloud.a + cloud.rgb, 1.0 );
}
`,
	[...COMMON_INCLUDES, phaseWGSL, skyWGSL, cloudHelpersWGSL, cloudShadowWGSL]
)

export type SunLightOptions = {
	intensity?: number // cường độ đèn mặt trời lúc giữa trưa
	hemi?: THREE.HemisphereLight
	hemiIntensity?: number
}

// Mây thể tích Nubis (Guerrilla Games) cho một WebGPURenderer có sẵn.
//   const clouds = new NubisCloudscape(renderer, { coverageBias: 0.4 })
//   await clouds.init()
//   mỗi frame: clouds.render(scene, camera, delta)   // thay cho renderer.render(scene, camera)
//
// Ba pass: scene → render target HDR + depth, mây → target độ phân giải thấp, composite → màn hình.
// Camera phải là PerspectiveCamera với depth thường (không reversed / logarithmic) vì shader
// dựng lại khoảng cách từ near / far.
export class NubisCloudscape {
	readonly params: NubisParams
	readonly sunDirection = new THREE.Vector3(0, 1, 0)
	readonly textures: NubisTextures

	#renderer: THREE.WebGPURenderer
	#time = 0
	#ready = false
	#size = new THREE.Vector2()
	#sceneRT: THREE.RenderTarget
	#cloudRT: THREE.RenderTarget
	#depthTexture: THREE.DepthTexture
	#cloudMaterial = new THREE.NodeMaterial()
	#compositeMaterial = new THREE.NodeMaterial()
	#cloudQuad: THREE.QuadMesh
	#compositeQuad: THREE.QuadMesh

	// uniform dùng chung cho pass mây và composite
	#u = {
		camPos: uniform(new THREE.Vector3()),
		camTan: uniform(new THREE.Vector2(1, 1)),
		camWorld: uniform(new THREE.Matrix4()),
		camNear: uniform(0.5),
		camFar: uniform(200_000),
		sunDir: uniform(this.sunDirection),
		sunIntensity: uniform(0),
		windDir: uniform(new THREE.Vector3(1, 0, 0)),
		uLayer: uniform(new THREE.Vector4()),
		uScale: uniform(new THREE.Vector4()),
		uShape: uniform(new THREE.Vector4()),
		uProfile: uniform(new THREE.Vector4()),
		uAnim: uniform(new THREE.Vector4()),
		uLight: uniform(new THREE.Vector4()),
		uLight2: uniform(new THREE.Vector4()),
		uMarch: uniform(new THREE.Vector4()),
		fogDensity: uniform(0),
		cloudSize: uniform(new THREE.Vector2(1, 1)),
		cloudsOn: uniform(1),
		cloudShadow: uniform(0),
	}
	// packUniforms ghi thẳng vào value của các uniform trên
	#packed: PackedUniforms = {
		uLayer: this.#u.uLayer.value,
		uScale: this.#u.uScale.value,
		uShape: this.#u.uShape.value,
		uProfile: this.#u.uProfile.value,
		uAnim: this.#u.uAnim.value,
		uLight: this.#u.uLight.value,
		uLight2: this.#u.uLight2.value,
		uMarch: this.#u.uMarch.value,
		fogDensity: 0,
	}

	constructor(renderer: THREE.WebGPURenderer, params: Partial<NubisParams> = {}) {
		this.#renderer = renderer
		this.params = { ...defaultNubisParams, ...params }
		this.textures = new NubisTextures(renderer)
		this.#syncWeatherParams()

		renderer.getDrawingBufferSize(this.#size)
		const { x: w, y: h } = this.#size
		this.#depthTexture = new THREE.DepthTexture(w, h)
		this.#sceneRT = new THREE.RenderTarget(w, h, {
			type: THREE.HalfFloatType,
			depthTexture: this.#depthTexture,
			minFilter: THREE.LinearFilter,
			magFilter: THREE.LinearFilter,
		})
		const scale = this.params.renderScale
		this.#cloudRT = new THREE.RenderTarget(Math.ceil(w * scale), Math.ceil(h * scale), {
			type: THREE.HalfFloatType,
			depthBuffer: false,
			minFilter: THREE.LinearFilter,
			magFilter: THREE.LinearFilter,
		})

		const u = this.#u
		const shape = texture3D(this.textures.shape)
		const detail = texture3D(this.textures.detail)
		const curl = texture(this.textures.curl)
		const weather = texture(this.textures.weather)
		const depth = texture(this.#depthTexture, uv())

		const cloud = this.#cloudMaterial
		cloud.depthTest = cloud.depthWrite = false
		cloud.fragmentNode = cloudMarchFn({
			uv: uv(),
			fragCoord: uv().mul(u.cloudSize),
			sceneDepth: depth.r,
			camPos: u.camPos,
			camTan: u.camTan,
			camWorld: u.camWorld,
			camNear: u.camNear,
			camFar: u.camFar,
			shapeTex: shape,
			shapeSampler: shape,
			detailTex: detail,
			detailSampler: detail,
			curlTex: curl,
			curlSampler: curl,
			weatherTex: weather,
			weatherSampler: weather,
			sunDir: u.sunDir,
			sunIntensity: u.sunIntensity,
			windDir: u.windDir,
			uLayer: u.uLayer,
			uScale: u.uScale,
			uShape: u.uShape,
			uProfile: u.uProfile,
			uAnim: u.uAnim,
			uLight: u.uLight,
			uLight2: u.uLight2,
			uMarch: u.uMarch,
			fogDensity: u.fogDensity,
		})
		this.#cloudQuad = new THREE.QuadMesh(cloud)

		const comp = this.#compositeMaterial
		comp.depthTest = comp.depthWrite = false
		comp.fragmentNode = compositeFn({
			uv: uv(),
			sceneColor: texture(this.#sceneRT.texture, uv()),
			sceneDepth: depth.r,
			cloudIn: texture(this.#cloudRT.texture, uv()),
			cloudsOn: u.cloudsOn,
			camPos: u.camPos,
			camTan: u.camTan,
			camWorld: u.camWorld,
			camNear: u.camNear,
			camFar: u.camFar,
			sunDir: u.sunDir,
			sunIntensity: u.sunIntensity,
			fogDensity: u.fogDensity,
			debugMode: u.uMarch.z,
			cloudShadow: u.cloudShadow,
			windDir: u.windDir,
			shapeTex: shape,
			shapeSampler: shape,
			detailTex: detail,
			detailSampler: detail,
			curlTex: curl,
			curlSampler: curl,
			weatherTex: weather,
			weatherSampler: weather,
			uLayer: u.uLayer,
			uScale: u.uScale,
			uShape: u.uShape,
			uProfile: u.uProfile,
			uAnim: u.uAnim,
			uLight: u.uLight,
			uLight2: u.uLight2,
		})
		this.#compositeQuad = new THREE.QuadMesh(comp)
		this.#syncUniforms()
	}

	// Sinh noise texture bằng compute shader, gọi một lần trước frame đầu tiên.
	async init() {
		const ms = await this.textures.generateAll()
		this.#ready = true
		return ms
	}

	setParams(params: Partial<NubisParams>) {
		const prev = { ...this.params }
		Object.assign(this.params, params)
		if (WEATHER_KEYS.some((k) => prev[k] !== this.params[k])) {
			this.#syncWeatherParams()
			if (this.#ready) void this.textures.regenerateWeather()
		}
		if (prev.renderScale !== this.params.renderScale) this.setSize()
		this.#syncUniforms()
	}

	// Gọi sau renderer.setSize() / setPixelRatio().
	setSize() {
		const { x: w, y: h } = this.#renderer.getDrawingBufferSize(this.#size)
		this.#sceneRT.setSize(w, h)
		const scale = this.params.renderScale
		this.#cloudRT.setSize(Math.ceil(w * scale), Math.ceil(h * scale))
	}

	render(scene: THREE.Scene, camera: THREE.PerspectiveCamera, delta = 0) {
		const renderer = this.#renderer
		const p = this.params
		if (p.animate) this.#time += delta
		this.#syncUniforms()

		const u = this.#u
		camera.updateMatrixWorld()
		u.camPos.value.setFromMatrixPosition(camera.matrixWorld)
		const tanY = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
		u.camTan.value.set(tanY * camera.aspect, tanY)
		u.camWorld.value.copy(camera.matrixWorld)
		u.camNear.value = camera.near
		u.camFar.value = camera.far

		renderer.toneMappingExposure = p.exposure
		renderer.toneMapping = p.debugMode > 0 ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping

		const target = renderer.getRenderTarget()
		// 1. scene → HDR target (+ depth)
		renderer.setRenderTarget(this.#sceneRT)
		renderer.render(scene, camera)

		// 2. mây → target độ phân giải thấp
		const clouds = p.clouds && this.#ready
		u.cloudsOn.value = clouds ? 1 : 0
		if (clouds) {
			u.cloudSize.value.set(this.#cloudRT.width, this.#cloudRT.height)
			renderer.setRenderTarget(this.#cloudRT)
			this.#cloudQuad.render(renderer)
		}

		// 3. composite → màn hình (renderer áp tone mapping + sRGB)
		renderer.setRenderTarget(target)
		this.#compositeQuad.render(renderer)
	}

	// Cho đèn của scene đi theo mặt trời Nubis: hướng, màu (đỏ dần lúc hoàng hôn), cường độ.
	// Giữ nguyên khoảng cách đèn – target để shadow camera vẫn vừa scene.
	applySunLight(light: THREE.DirectionalLight, options: SunLightOptions = {}) {
		const { intensity = 3, hemi, hemiIntensity = 1 } = options
		const sd = this.sunDirection
		const target = light.target.position
		const dist = light.position.distanceTo(target) || 1000
		light.position.copy(target).addScaledVector(sd, dist)

		const { smoothstep, lerp } = THREE.MathUtils
		const day = smoothstep(sd.y, -0.05, 0.35)
		const warm = smoothstep(sd.y, 0, 0.3)
		light.color.setRGB(1, lerp(0.45, 0.97, warm), lerp(0.15, 0.92, warm))
		light.intensity = intensity * day
		if (hemi) hemi.intensity = hemiIntensity * (0.2 + 0.8 * day)
	}

	dispose() {
		this.#sceneRT.dispose()
		this.#cloudRT.dispose()
		this.#depthTexture.dispose()
		this.#cloudMaterial.dispose()
		this.#compositeMaterial.dispose()
		this.textures.dispose()
	}

	#syncWeatherParams() {
		const wp = this.textures.weatherParams
		wp.coverageBias.value = this.params.coverageBias
		wp.typeBias.value = this.params.typeBias
		wp.precipBias.value = this.params.precipBias
		wp.seed.value = this.params.weatherSeed
	}

	#syncUniforms() {
		const p = this.params
		const u = this.#u
		sunDirection(p.sunAzimuth, p.sunElevation, this.sunDirection)
		u.sunIntensity.value = p.sunIntensity
		const wd = THREE.MathUtils.degToRad(p.windDirection)
		u.windDir.value.set(Math.sin(wd), 0, Math.cos(wd))
		packUniforms(p, this.#time, this.#packed)
		u.fogDensity.value = this.#packed.fogDensity
		u.cloudShadow.value = p.cloudShadow
	}
}
