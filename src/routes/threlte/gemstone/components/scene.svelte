<script lang="ts">
	import { onMount } from 'svelte'
	// import { T } from '@threlte/core'
	// import { Gizmo, OrbitControls } from '@threlte/extras'
	import * as THREE from 'three'
	import {
		EffectComposer,
		HDRLoader,
		OrbitControls,
		RenderPass,
		UnrealBloomPass,
	} from 'three/examples/jsm/Addons.js'

	let container: HTMLDivElement

	function xmur3(str: string) {
		let h = 1779033703 ^ str.length
		for (let i = 0; i < str.length; i++) {
			h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
			h = (h << 13) | (h >>> 19)
		}
		return function () {
			h = Math.imul(h ^ (h >>> 16), 2246822507)
			h = Math.imul(h ^ (h >>> 13), 3266489909)
			return (h ^= h >>> 16) >>> 0
		}
	}
	function sfc32(a: number, b: number, c: number, d: number) {
		return function () {
			a >>>= 0
			b >>>= 0
			c >>>= 0
			d >>>= 0
			let t = (a + b) | 0
			a = b ^ (b >>> 9)
			b = (c + (c << 3)) | 0
			c = (c << 21) | (c >>> 11)
			d = (d + 1) | 0
			t = (t + d) | 0
			c = (c + t) | 0
			return (t >>> 0) / 4294967296
		}
	}
	function makeRngFromString(seedStr: string) {
		const seed = xmur3(seedStr)
		return sfc32(seed(), seed(), seed(), seed())
	}
	function randUnitVector(rng: () => number) {
		// uniform on sphere
		const u = rng()
		const v = rng()
		const theta = 2 * Math.PI * u
		const z = 2 * v - 1
		const r = Math.sqrt(Math.max(0, 1 - z * z))
		return new THREE.Vector3(r * Math.cos(theta), r * Math.sin(theta), z)
	}

	// ---------- "Algorithmic carving" (cheap but gem-like) ----------
	function carveGemGeometry(
		seedStr: string,
		opts?: {
			radius?: number
			detail?: number
			cuts?: number
			chipiness?: number
			facetHardness?: number
		}
	) {
		const {
			radius = 1.0,
			detail = 4,
			cuts = 26,
			chipiness = 0.015,
			facetHardness = 1.0, // 1 = hard facets, 0 = softer
		} = opts || {}

		const rng = makeRngFromString(seedStr)

		// start from a dense sphere-ish poly
		const geom = new THREE.IcosahedronGeometry(radius, detail)
		const pos = geom.attributes.position
		const p = new THREE.Vector3()

		// carve by projecting vertices back onto many random planes
		for (let i = 0; i < cuts; i++) {
			const n = randUnitVector(rng).normalize()

			// plane offset: closer to radius => smaller stone; closer to center => more aggressive cuts
			const d = radius * (0.25 + 0.55 * rng())

			for (let j = 0; j < pos.count; j++) {
				p.fromBufferAttribute(pos, j)
				const side = p.dot(n) - d
				if (side > 0) {
					// project back to plane: p' = p - n * side
					p.addScaledVector(n, -side * facetHardness)
					pos.setXYZ(j, p.x, p.y, p.z)
				}
			}
		}

		// micro chips / imperfections (tiny radial jitter)
		for (let j = 0; j < pos.count; j++) {
			p.fromBufferAttribute(pos, j)
			const radial = p.clone().normalize()
			const jitter = (rng() - 0.5) * chipiness
			p.addScaledVector(radial, jitter)
			pos.setXYZ(j, p.x, p.y, p.z)
		}

		geom.computeVertexNormals()
		geom.attributes.position.needsUpdate = true
		geom.attributes.normal.needsUpdate = true

		return geom
	}

	async function init() {
		// ---------- Scene ----------
		const scene = new THREE.Scene()

		const camera = new THREE.PerspectiveCamera(
			45,
			container.clientWidth / container.clientHeight,
			0.01,
			100
		)
		camera.position.set(0.0, 0.9, 2.8)

		const renderer = new THREE.WebGLRenderer({ antialias: true })
		renderer.setSize(container.clientWidth, container.clientHeight)
		renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
		renderer.outputColorSpace = THREE.SRGBColorSpace
		renderer.toneMapping = THREE.ACESFilmicToneMapping
		renderer.toneMappingExposure = 0.35
		container.appendChild(renderer.domElement)

		const controls = new OrbitControls(camera, renderer.domElement)
		controls.enableDamping = true

		// Lighting (envmap is the main one for gems)
		const key = new THREE.DirectionalLight(0xffffff, 0.3)
		key.position.set(3, 4, 2)
		scene.add(key)

		const rim = new THREE.PointLight(0xffffff, 5.0, 10)
		rim.position.set(-2.2, 1.2, -1.8)
		scene.add(rim)

		// HDRI env
		const pmrem = new THREE.PMREMGenerator(renderer)
		pmrem.compileEquirectangularShader()

		// Public HDR from three.js examples
		const hdrUrl = '/images/events_hall_interior_1k.hdr'
		const envTex = await new HDRLoader().loadAsync(hdrUrl)
		const envMap = pmrem.fromEquirectangular(envTex).texture
		envTex.dispose()
		pmrem.dispose()
		scene.environment = envMap
		scene.backgroundIntensity = 0.3
		scene.background = envMap

		// ---------- Material (gem look) ----------
		const material = new THREE.MeshPhysicalMaterial({
			color: 0xffffff,
			metalness: 0.0,
			roughness: 0.05,

			// glass volume
			transmission: 1.0,
			ior: 1.85,
			thickness: 1.1,

			// volumetric absorption -> "màu nằm trong khối"
			attenuationColor: new THREE.Color('#7f3cff'),
			attenuationDistance: 0.85,

			// chromatic dispersion (needs transmission)
			dispersion: 0.55,

			// extra sparkle-ish
			specularIntensity: 0.8,
			specularColor: new THREE.Color(0xffffff),
			envMapIntensity: 0.5,
		})
		material.opacity = 1.0

		let gemMesh: THREE.Mesh | null = null

		function buildGem(seedStr: string) {
			if (gemMesh) {
				gemMesh.geometry.dispose()
				scene.remove(gemMesh)
			}

			const geom = carveGemGeometry(seedStr, {
				radius: 1.0,
				detail: 4,
				cuts: 28,
				chipiness: 0.02,
				facetHardness: params.facetHardness,
			})

			gemMesh = new THREE.Mesh(geom, material)
			gemMesh.scale.setScalar(1.0)
			scene.add(gemMesh)
		}

		// ---------- Post (bloom) ----------
		const composer = new EffectComposer(renderer)
		composer.addPass(new RenderPass(scene, camera))
		const bloomPass = new UnrealBloomPass(
			new THREE.Vector2(container.clientWidth, container.clientHeight),
			0.15, // strength
			0.5, // radius
			0.8 // threshold
		)
		composer.addPass(bloomPass)

		// ---------- UI ----------
		const params = {
			// seed: (document.getElementById('seedInput') as HTMLInputElement)?.value || 'default',
			seed: '15071991',
			ior: material.ior,
			roughness: material.roughness,
			thickness: material.thickness,
			attenuationDistance: material.attenuationDistance,
			attenuationColor: '#7f3cff',
			dispersion: material.dispersion,
			envMapIntensity: material.envMapIntensity,
			exposure: renderer.toneMappingExposure,
			bloomStrength: bloomPass.strength,
			bloomRadius: bloomPass.radius,
			bloomThreshold: bloomPass.threshold,
			rotate: true,
			facetHardness: 1.0,
			flatShading: false,
			regenerate: () => buildGem(params.seed),
		}

		// initial
		buildGem(params.seed)

		// resize
		addEventListener('resize', () => {
			camera.aspect = container.clientWidth / container.clientHeight
			camera.updateProjectionMatrix()
			renderer.setSize(container.clientWidth, container.clientHeight)
			composer.setSize(container.clientWidth, container.clientHeight)
		})

		// loop
		const clock = new THREE.Clock()
		function animate() {
			requestAnimationFrame(animate)
			const t = clock.getElapsedTime()
			controls.update()
			if (gemMesh && params.rotate) {
				gemMesh.rotation.y = t * 0.35
				gemMesh.rotation.x = Math.sin(t * 0.25) * 0.08
			}
			composer.render()
		}
		animate()
	}

	onMount(() => {
		init()
	})
</script>

<div bind:this={container} class="aspect-video"></div>

<!-- <T.PerspectiveCamera makeDefault position={[10, 7, 6]} lookAt.y={0}>
	<OrbitControls>
		<Gizmo />
	</OrbitControls>
</T.PerspectiveCamera>

<T.DirectionalLight position.y={10} position.z={10} />
<T.AmbientLight intensity={0.3} />
<T.GridHelper args={[10, 10]} />

<T.Mesh position={[0, 3, 0]}>
	<T.BoxGeometry args={[1, 1, 1]} />
	<T.MeshBasicMaterial color="red" />
</T.Mesh> -->
