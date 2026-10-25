import * as THREE from 'three'
import vertexShader from './shaders/volume.vert?raw'
import noise from './shaders/noise.glsl?raw'
import cloudShader from './shaders/cloud.frag?raw'
import {
	CLOUD_KINDS,
	MAX_BLOBS,
	createCloudShape,
	createRandom,
	scatter,
	type CloudKind,
	type CloudShape,
} from './shapes'

export type CloudFieldOptions = {
	seed?: number
	// số đám mây mỗi kiểu
	counts?: Partial<Record<CloudKind, number>>
	// mây trôi trong hình vuông [-extent, extent] quanh gốc, ra khỏi thì quay vòng
	extent?: number
	altitude?: [min: number, max: number] // độ cao chân mây
	wind?: THREE.Vector3 // world unit / giây
	sunDirection?: THREE.Vector3 // hướng TỚI mặt trời
	sunColor?: THREE.ColorRepresentation
	sunIntensity?: number
	skyColor?: THREE.ColorRepresentation
	groundColor?: THREE.ColorRepresentation
	fog?: THREE.Fog | null
	detail?: number // tần số noise, 1/world unit
	steps?: number
	lightSteps?: number
}

type Cloud = { mesh: THREE.Mesh<THREE.BoxGeometry, THREE.ShaderMaterial>; shape: CloudShape }

const DEFAULT_COUNTS: Record<CloudKind, number> = {
	cumulus: 4,
	towering: 2,
	stratus: 2,
	cluster: 2,
}

// Nhiều đám mây thể tích để thả vào một scene three.js có sẵn.
//   const clouds = new CloudField({ sunDirection: sun.position, fog: scene.fog })
//   scene.add(clouds.group)
//   mỗi frame: clouds.update(delta)
export class CloudField {
	readonly group = new THREE.Group()
	readonly clouds: Cloud[] = []
	readonly wind: THREE.Vector3
	readonly extent: number

	#geometry = new THREE.BoxGeometry(2, 2, 2) // hộp [-1, 1]^3, scale theo kích thước mây
	// uniform dùng chung: đổi một lần, mọi đám mây cùng thấy
	#shared: Record<string, THREE.IUniform>

	constructor(options: CloudFieldOptions = {}) {
		const rng = createRandom(options.seed ?? 7)
		this.extent = options.extent ?? 380
		this.wind = options.wind?.clone() ?? new THREE.Vector3(3, 0, 1.2)
		const [minY, maxY] = options.altitude ?? [55, 90]
		const fog = options.fog ?? null

		this.#shared = {
			uLightDir: {
				value: (options.sunDirection ?? new THREE.Vector3(0.5, 1, 0.3)).clone().normalize(),
			},
			uLightColor: {
				value: new THREE.Color(options.sunColor ?? '#fff4e0').multiplyScalar(
					options.sunIntensity ?? 22
				),
			},
			uSkyColor: { value: new THREE.Color(options.skyColor ?? '#b9d4ec').multiplyScalar(0.9) },
			uGroundColor: {
				value: new THREE.Color(options.groundColor ?? '#6b7080').multiplyScalar(0.6),
			},
			uDetail: { value: options.detail ?? 0.075 },
			uTime: { value: 0 },
			uSteps: { value: options.steps ?? 40 },
			uLightSteps: { value: options.lightSteps ?? 5 },
			uFogColor: { value: fog ? fog.color : new THREE.Color('#ffffff') },
			uFogNear: { value: fog ? fog.near : 1e6 },
			uFogFar: { value: fog ? fog.far : 2e6 },
		}

		const counts = { ...DEFAULT_COUNTS, ...options.counts }
		const kinds = CLOUD_KINDS.flatMap((kind) => Array<CloudKind>(counts[kind]).fill(kind))
		// rải trong vùng giữa (chưa bị mờ ở rìa), mỗi đám một ô lưới
		const spots = scatter(kinds.length, this.extent * 0.7, rng)
		kinds.forEach((kind, i) => {
			const shape = createCloudShape(kind, rng)
			const bottom = minY + rng() * (maxY - minY)
			const [x, z] = spots[i]
			this.#add(shape, new THREE.Vector3(x, bottom + shape.size[1] / 2, z))
		})
		this.group.name = 'clouds'
	}

	#add(shape: CloudShape, position: THREE.Vector3) {
		const blobs = Array.from({ length: MAX_BLOBS }, (_, i) => {
			const b = shape.blobs[i]
			return b ? new THREE.Vector4(...b.center, b.radius) : new THREE.Vector4()
		})
		const half = new THREE.Vector3(...shape.size).multiplyScalar(0.5)
		const material = new THREE.ShaderMaterial({
			vertexShader,
			fragmentShader: noise + cloudShader,
			defines: { MAX_BLOBS },
			uniforms: {
				...this.#shared,
				uCenter: { value: new THREE.Vector3() },
				uHalfSize: { value: half },
				uBlobs: { value: blobs },
				uBlobCount: { value: shape.blobs.length },
				uSquash: { value: new THREE.Vector3(...shape.squash) },
				uBase: { value: shape.base },
				uErosion: { value: shape.erosion },
				uStretch: { value: new THREE.Vector3(...shape.stretch) },
				uSeed: { value: new THREE.Vector3(...shape.seed) },
				uDensity: { value: shape.density },
				uFade: { value: 1 },
			},
			side: THREE.BackSide, // vẫn thấy mây khi camera bay vào trong hộp
			transparent: true,
			premultipliedAlpha: true,
			depthWrite: false,
		})
		const mesh = new THREE.Mesh(this.#geometry, material)
		mesh.name = `cloud-${shape.kind}`
		mesh.position.copy(position)
		mesh.scale.copy(half)
		material.uniforms.uCenter.value = mesh.position // shader luôn thấy vị trí hiện tại
		this.clouds.push({ mesh, shape })
		this.group.add(mesh)
	}

	update(delta: number) {
		this.#shared.uTime.value += delta
		const e = this.extent
		for (const { mesh, shape } of this.clouds) {
			const p = mesh.position
			p.addScaledVector(this.wind, delta)
			// trôi ra khỏi vùng thì vòng sang phía đối diện
			const wrap = (v: number) => ((((v + e) % (2 * e)) + 2 * e) % (2 * e)) - e
			p.x = wrap(p.x)
			p.z = wrap(p.z)
			// mờ dần ở gần rìa để lúc vòng lại không thấy mây biến mất đột ngột
			const edge =
				Math.max(Math.abs(p.x), Math.abs(p.z)) + Math.max(shape.size[0], shape.size[2]) / 2
			mesh.material.uniforms.uFade.value = 1 - THREE.MathUtils.smoothstep(edge, e * 0.75, e)
		}
	}

	dispose() {
		this.#geometry.dispose()
		for (const { mesh } of this.clouds) mesh.material.dispose()
		this.group.clear()
	}
}
