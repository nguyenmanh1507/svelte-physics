import * as THREE from 'three/webgpu'
import { texture, texture3D, uniform, uv } from 'three/tsl'
import type { NubisCloudscape, NubisPass } from './nubis-cloudscape'
import { shaftMarchFn, shaftShadowMapFn, shaftUpsampleFn } from './wgsl/light-shafts'

// Tia nắng xuyên mây. Độ dài tính bằng mét Nubis, nhân với `scale` của cloudscape như mọi độ dài khác.
export type LightShaftParams = {
	enabled: boolean
	intensity: number
	density: number // hệ số tán xạ của không khí (1/m)
	steps: number // số bước ray march mỗi pixel (≤ 64)
	anisotropy: number // g của Henyey-Greenstein: > 0 sáng mạnh khi nhìn về phía mặt trời
	maxDistance: number // m, quãng đường tối đa tính tia nắng
	resolution: number // độ phân giải pass so với màn hình
	sharpness: number // 0–1, độ sắc viền tia (ngưỡng hoá vùng khe mây)
	gapThreshold: number // 0–1, độ xuyên sáng của mây từ đó coi là khe
	blurLength: number // px, làm mịn nhiễu dọc theo hướng tia (không làm nhoè hai bên)
}

export const defaultLightShaftParams: LightShaftParams = {
	enabled: true,
	intensity: 1.5,
	density: 0.00012,
	steps: 32,
	anisotropy: 0.65,
	maxDistance: 12_000,
	resolution: 0.75,
	sharpness: 0.8,
	gapThreshold: 0.25,
	blurLength: 24,
}

const SHADOW_SIZE = 512

// Góc nhỏ nhất của shadow map quanh camera, bám theo lưới texel để bóng không rung khi camera di chuyển.
export function shadowMapOrigin(camX: number, camZ: number, extent: number, size = SHADOW_SIZE) {
	const texel = extent / size
	const snap = (v: number) => Math.floor((v - extent / 2) / texel) * texel
	return [snap(camX), snap(camZ)] as const
}

// Pass phụ của NubisCloudscape:
//   const shafts = new NubisLightShafts(cloudscape)
//   cloudscape.addPass(shafts)   // cloudscape.dispose() sẽ giải phóng luôn pass này
export class NubisLightShafts implements NubisPass {
	readonly params: LightShaftParams

	#cloudscape: NubisCloudscape
	#size = new THREE.Vector2(1, 1)
	#shadowRT = new THREE.RenderTarget(SHADOW_SIZE, SHADOW_SIZE, {
		type: THREE.HalfFloatType,
		depthBuffer: false,
		minFilter: THREE.LinearFilter,
		magFilter: THREE.LinearFilter,
	})
	#shaftRT = new THREE.RenderTarget(1, 1, {
		type: THREE.HalfFloatType,
		depthBuffer: false,
		minFilter: THREE.LinearFilter,
		magFilter: THREE.LinearFilter,
	})
	#materials: THREE.NodeMaterial[] = []
	#shadowQuad: THREE.QuadMesh
	#marchQuad: THREE.QuadMesh
	#upsampleQuad: THREE.QuadMesh
	#u = {
		mapOrigin: uniform(new THREE.Vector2()),
		mapExtent: uniform(1),
		density: uniform(0),
		steps: uniform(24),
		anisotropy: uniform(0.35),
		intensity: uniform(1),
		maxDist: uniform(1),
		gapThreshold: uniform(0.25),
		sharpness: uniform(0.8),
		blurLength: uniform(24),
		shaftSize: uniform(new THREE.Vector2(1, 1)),
	}

	constructor(cloudscape: NubisCloudscape, params: Partial<LightShaftParams> = {}) {
		this.#cloudscape = cloudscape
		this.params = { ...defaultLightShaftParams, ...params }
		const { uniforms: c, textures, depthTexture, cloudTexture } = cloudscape.shared
		const u = this.#u

		const shape = texture3D(textures.shape)
		const detail = texture3D(textures.detail)
		const curl = texture(textures.curl)
		const weather = texture(textures.weather)
		const material = (node: THREE.Node, additive = false) => {
			const m = new THREE.NodeMaterial()
			m.depthTest = m.depthWrite = false
			if (additive) {
				m.transparent = true
				m.blending = THREE.AdditiveBlending
			}
			m.fragmentNode = node
			this.#materials.push(m)
			return new THREE.QuadMesh(m)
		}

		this.#shadowQuad = material(
			shaftShadowMapFn({
				uv: uv(),
				mapOrigin: u.mapOrigin,
				mapExtent: u.mapExtent,
				sunDir: c.sunDir,
				windDir: c.windDir,
				shapeTex: shape,
				shapeSampler: shape,
				detailTex: detail,
				detailSampler: detail,
				curlTex: curl,
				curlSampler: curl,
				weatherTex: weather,
				weatherSampler: weather,
				uLayer: c.uLayer,
				uScale: c.uScale,
				uShape: c.uShape,
				uProfile: c.uProfile,
				uAnim: c.uAnim,
				uLight: c.uLight,
				uLight2: c.uLight2,
			})
		)

		const shadow = texture(this.#shadowRT.texture)
		this.#marchQuad = material(
			shaftMarchFn({
				uv: uv(),
				fragCoord: uv().mul(u.shaftSize),
				sceneDepth: texture(depthTexture, uv()).r,
				cloudIn: texture(cloudTexture, uv()),
				camPos: c.camPos,
				camTan: c.camTan,
				camWorld: c.camWorld,
				camNear: c.camNear,
				camFar: c.camFar,
				sunDir: c.sunDir,
				sunIntensity: c.sunIntensity,
				uLayer: c.uLayer,
				shadowTex: shadow,
				shadowSampler: shadow,
				mapOrigin: u.mapOrigin,
				mapExtent: u.mapExtent,
				density: u.density,
				steps: u.steps,
				anisotropy: u.anisotropy,
				intensity: u.intensity,
				maxDist: u.maxDist,
				gapThreshold: u.gapThreshold,
				sharpness: u.sharpness,
			})
		)

		const shafts = texture(this.#shaftRT.texture)
		this.#upsampleQuad = material(
			shaftUpsampleFn({
				uv: uv(),
				shaftTex: shafts,
				shaftSampler: shafts,
				shaftSize: u.shaftSize,
				camWorld: c.camWorld,
				camTan: c.camTan,
				sunDir: c.sunDir,
				blurLength: u.blurLength,
			}),
			true
		)
	}

	setParams(params: Partial<LightShaftParams>) {
		const resolution = this.params.resolution
		Object.assign(this.params, params)
		if (resolution !== this.params.resolution) this.setSize(this.#size.x, this.#size.y)
	}

	setSize(width: number, height: number) {
		this.#size.set(width, height)
		const r = this.params.resolution
		const w = Math.max(1, Math.ceil(width * r))
		const h = Math.max(1, Math.ceil(height * r))
		this.#shaftRT.setSize(w, h)
		this.#u.shaftSize.value.set(w, h)
	}

	render(renderer: THREE.WebGPURenderer, hdr: THREE.RenderTarget, camera: THREE.PerspectiveCamera) {
		const { params: cloud, ready } = this.#cloudscape.shared
		const p = this.params
		if (!p.enabled || !cloud.clouds || !ready) return

		// mét Nubis -> world unit, như fogDensity / maxDistance của cloudscape
		const s = cloud.scale
		const u = this.#u
		u.density.value = p.density / s
		u.steps.value = Math.min(64, Math.max(1, Math.round(p.steps)))
		u.anisotropy.value = p.anisotropy
		u.intensity.value = p.intensity
		u.maxDist.value = p.maxDistance * s
		u.gapThreshold.value = p.gapThreshold
		u.sharpness.value = p.sharpness
		u.blurLength.value = p.blurLength
		// shadow map phủ cả tầm tia nắng, thêm phần lệch do chiếu theo hướng nắng lên chân mây
		const extent = 2 * (p.maxDistance + cloud.layerBottom * 2) * s
		u.mapExtent.value = extent
		const [ox, oz] = shadowMapOrigin(camera.position.x, camera.position.z, extent)
		u.mapOrigin.value.set(ox, oz)

		const target = renderer.getRenderTarget()
		renderer.setRenderTarget(this.#shadowRT)
		this.#shadowQuad.render(renderer)
		renderer.setRenderTarget(this.#shaftRT)
		this.#marchQuad.render(renderer)

		// cộng dồn vào ảnh HDR: không được clear target
		const autoClear = renderer.autoClear
		renderer.autoClear = false
		renderer.setRenderTarget(hdr)
		this.#upsampleQuad.render(renderer)
		renderer.autoClear = autoClear
		renderer.setRenderTarget(target)
	}

	dispose() {
		this.#shadowRT.dispose()
		this.#shaftRT.dispose()
		for (const m of this.#materials) m.dispose()
	}
}
