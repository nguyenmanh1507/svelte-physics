<script lang="ts">
	import { onMount } from 'svelte'
	import * as THREE from 'three'
	import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
	import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
	import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
	import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
	import { CloudField } from '#lib/components/volumetric-cloud/index.js'
	import { assetUrl, GRID, TILE, type RoadAsset } from './road-assets'
	import type { Placement } from './road-map'

	let {
		placements,
		labels = false,
		clouds = false,
		onload,
	}: {
		placements: Placement[]
		labels?: boolean // hiện tên asset (chế độ gallery)
		clouds?: boolean // hiện mây thể tích trôi trên thành phố
		onload?: (info: { assets: number; instances: number }) => void
	} = $props()

	let container: HTMLDivElement | null = null
	let canvas: HTMLCanvasElement | null = null
	let labelLayer: HTMLDivElement | null = null
	let loading = $state(true)
	let cloudField = $state.raw<CloudField | null>(null)

	// bật/tắt mây không cần dựng lại scene
	$effect(() => {
		if (cloudField) cloudField.group.visible = clouds
	})

	// Gộp mọi mesh của một file GLB thành một geometry (đa số file chỉ có 1 mesh).
	function bakeGeometry(root: THREE.Object3D) {
		root.updateMatrixWorld(true)
		const parts: THREE.BufferGeometry[] = []
		let material: THREE.Material | null = null
		root.traverse((obj) => {
			if (!(obj instanceof THREE.Mesh)) return
			material ??= obj.material as THREE.Material
			const geometry = (obj.geometry as THREE.BufferGeometry).clone().applyMatrix4(obj.matrixWorld)
			// scale âm (nắp phải của dumpster) đảo chiều tam giác -> đảo lại cho đúng mặt
			if (obj.matrixWorld.determinant() < 0 && geometry.index) {
				const idx = geometry.index.array
				for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]]
			}
			parts.push(geometry.index ? geometry.toNonIndexed() : geometry)
		})
		const geometry = parts.length === 1 ? parts[0] : mergeGeometries(parts)!
		return { geometry, material: material! }
	}

	onMount(() => {
		if (!container || !canvas || !labelLayer) return

		const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
		renderer.shadowMap.enabled = true

		const labelRenderer = new CSS2DRenderer({ element: labelLayer })

		const scene = new THREE.Scene()
		scene.background = new THREE.Color('#a9c8e0')
		scene.fog = new THREE.Fog('#a9c8e0', 400, 900)

		const camera = new THREE.PerspectiveCamera(45, 1, 1, 2000)
		camera.position.set(190, 170, 210)

		scene.add(new THREE.HemisphereLight('#dfefff', '#4b4f5c', 1.6))
		const sun = new THREE.DirectionalLight('#fff4e0', 2.4)
		sun.position.set(120, 200, 80)
		sun.castShadow = true
		sun.shadow.mapSize.set(4096, 4096)
		sun.shadow.bias = -0.0005
		sun.shadow.normalBias = 0.3
		const half = (GRID * TILE) / 2 + 20
		Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half })
		sun.shadow.camera.far = 600
		scene.add(sun)

		// Mặt đất 300 x 300 dưới toàn bộ lưới
		const ground = new THREE.Mesh(
			new THREE.PlaneGeometry(GRID * TILE, GRID * TILE),
			new THREE.MeshStandardMaterial({ color: '#474b57', roughness: 1 })
		)
		ground.rotation.x = -Math.PI / 2
		ground.position.y = -0.05
		ground.receiveShadow = true
		scene.add(ground)

		// Mây trôi chậm theo gió Tây Bắc -> Đông Nam, ánh sáng cùng hướng mặt trời của scene.
		const field = new CloudField({
			sunDirection: sun.position,
			fog: scene.fog,
			skyColor: '#a9c8e0',
			groundColor: '#5d6170',
			wind: new THREE.Vector3(2.2, 0, 1),
		})
		scene.add(field.group)
		cloudField = field

		const controls = new OrbitControls(camera, renderer.domElement)
		controls.enableDamping = true
		controls.maxPolarAngle = Math.PI * 0.47
		controls.minDistance = 10
		controls.maxDistance = 800

		const byAsset = Map.groupBy(placements, (p) => p.asset)
		const meshes: THREE.InstancedMesh[] = []
		let sharedMaterial: THREE.Material | null = null
		let disposed = false

		const loader = new GLTFLoader()
		Promise.all(
			[...byAsset.keys()].map(async (name: RoadAsset) => ({
				name,
				...bakeGeometry((await loader.loadAsync(assetUrl(name))).scene),
			}))
		).then((models) => {
			if (disposed) return
			const m = new THREE.Matrix4()
			const q = new THREE.Quaternion()
			const up = new THREE.Vector3(0, 1, 0)
			const scale = new THREE.Vector3(TILE, TILE, TILE)
			for (const { name, geometry, material } of models) {
				sharedMaterial ??= material
				const list = byAsset.get(name)!
				const mesh = new THREE.InstancedMesh(geometry, sharedMaterial, list.length)
				list.forEach((p, i) => {
					q.setFromAxisAngle(up, ((p.rot ?? 0) * Math.PI) / 2)
					const pos = new THREE.Vector3(
						(p.x - GRID / 2) * TILE,
						(p.y ?? 0) * TILE,
						(p.z - GRID / 2) * TILE
					)
					mesh.setMatrixAt(i, m.compose(pos, q, scale))
					if (labels) {
						const el = document.createElement('div')
						el.className =
							'rounded bg-slate-950/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-100 whitespace-nowrap'
						el.textContent = name
						const label = new CSS2DObject(el)
						label.position.copy(pos).add(new THREE.Vector3(0, -2, TILE * 0.9))
						scene.add(label)
					}
				})
				mesh.castShadow = true
				mesh.receiveShadow = true
				mesh.computeBoundingSphere()
				meshes.push(mesh)
				scene.add(mesh)
			}
			for (const { material } of models) if (material !== sharedMaterial) material.dispose()
			loading = false
			onload?.({ assets: models.length, instances: placements.length })
		})

		const resize = () => {
			const { clientWidth: w, clientHeight: h } = container!
			renderer.setSize(w, h)
			labelRenderer.setSize(w, h)
			camera.aspect = w / h
			camera.updateProjectionMatrix()
		}
		const observer = new ResizeObserver(resize)
		observer.observe(container)
		resize()

		const timer = new THREE.Timer()
		renderer.setAnimationLoop(() => {
			timer.update()
			if (field.group.visible) field.update(timer.getDelta())
			controls.update()
			renderer.render(scene, camera)
			if (labels) labelRenderer.render(scene, camera)
		})

		return () => {
			disposed = true
			renderer.setAnimationLoop(null)
			observer.disconnect()
			controls.dispose()
			for (const mesh of meshes) {
				mesh.geometry.dispose()
				mesh.dispose()
			}
			sharedMaterial?.dispose()
			ground.geometry.dispose()
			ground.material.dispose()
			field.dispose()
			cloudField = null
			renderer.dispose()
		}
	})
</script>

<div
	bind:this={container}
	class="relative aspect-square w-full overflow-hidden rounded-lg bg-slate-900 lg:aspect-4/3"
>
	<canvas bind:this={canvas} class="block h-full w-full"></canvas>
	<div bind:this={labelLayer} class="pointer-events-none absolute inset-0"></div>
	{#if loading}
		<p
			class="absolute inset-0 grid place-items-center font-mono text-sm tracking-wide text-slate-200"
		>
			Đang tải model…
		</p>
	{/if}
</div>
