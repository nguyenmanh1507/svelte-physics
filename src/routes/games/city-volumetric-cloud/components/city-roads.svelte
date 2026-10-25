<script lang="ts">
	import Stats from 'stats.js'
	import * as THREE from 'three'
	import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
	import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
	import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
	import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
	import {
		NubisSky,
		type NubisParams,
		type NubisSceneHooks,
		type NubisSkyContext,
	} from '#lib/components/nubis-cloud/index.js'
	import { buildingUrl, type BuildingAsset } from './building-assets'
	import type { BuildingPlacement } from './building-map'
	import { assetUrl, GRID, TILE, type RoadAsset } from './road-assets'
	import type { Placement } from './road-map'

	let {
		placements,
		buildings = [],
		labels = false,
		clouds = false,
		sky = {},
		class: className = 'aspect-square w-full rounded-lg bg-slate-900 lg:aspect-4/3',
		onload,
	}: {
		placements: Placement[]
		buildings?: BuildingPlacement[] // building từ City Kit - Commercial
		labels?: boolean // hiện tên asset (chế độ gallery)
		clouds?: boolean // hiện mây thể tích trôi trên thành phố
		sky?: Partial<NubisParams> // cấu hình bầu trời Nubis, đổi trực tiếp không cần dựng lại scene
		class?: string // kích thước khung canvas
		onload?: (info: { assets: number; instances: number; buildings: number }) => void
	} = $props()

	let skyParams = $derived({ ...sky, clouds })

	let labelLayer: HTMLDivElement | null = null
	let statsHost: HTMLDivElement | null = null
	let loading = $state(true)

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

	function setup({ renderer, scene, camera, cloudscape }: NubisSkyContext): NubisSceneHooks {
		renderer.shadowMap.enabled = true
		const labelRenderer = new CSS2DRenderer({ element: labelLayer! })

		// FPS đo trong chính vòng render của scene (bấm vào để đổi sang ms / MB)
		const stats = new Stats()
		stats.showPanel(0)
		stats.dom.style.cssText = 'cursor: pointer; opacity: 0.9'
		statsHost!.append(stats.dom)

		// chỉ thấy khi không có WebGPU; có mây thì composite vẽ bầu trời Nubis đè lên
		scene.background = new THREE.Color('#a9c8e0')

		camera.fov = 45
		camera.near = 1
		camera.far = 6000
		camera.position.set(190, 170, 210)
		camera.updateProjectionMatrix()

		const hemi = new THREE.HemisphereLight('#dfefff', '#4b4f5c', 1.6)
		scene.add(hemi)
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

		// Mặt đất 300 x 300 dưới toàn bộ lưới, nối với một vùng đất rộng mờ dần vào sương ở chân trời
		const groundMaterial = new THREE.MeshStandardMaterial({ color: '#474b57', roughness: 1 })
		const ground = new THREE.Mesh(new THREE.PlaneGeometry(GRID * TILE, GRID * TILE), groundMaterial)
		ground.rotation.x = -Math.PI / 2
		ground.position.y = -0.05
		ground.receiveShadow = true
		scene.add(ground)
		const land = new THREE.Mesh(
			new THREE.PlaneGeometry(8000, 8000, 16, 16),
			new THREE.MeshStandardMaterial({ color: '#5a6352', roughness: 1 })
		)
		land.rotation.x = -Math.PI / 2
		land.position.y = -0.1
		land.receiveShadow = true
		scene.add(land)

		const controls = new OrbitControls(camera, renderer.domElement)
		controls.enableDamping = true
		controls.maxPolarAngle = Math.PI * 0.47
		controls.minDistance = 10
		controls.maxDistance = 800

		const meshes: THREE.InstancedMesh[] = []
		// mỗi kit Kenney có colormap riêng -> dùng chung một material trong từng kit
		const sharedMaterials: THREE.Material[] = []
		let disposed = false

		const loader = new GLTFLoader()
		type Item = { asset: string; x: number; z: number; y?: number; rot?: number }
		async function loadKit(list: Item[], url: (asset: string) => string) {
			const byAsset = Map.groupBy(list, (p) => p.asset)
			const models = await Promise.all(
				[...byAsset.keys()].map(async (name) => ({
					name,
					list: byAsset.get(name)!,
					...bakeGeometry((await loader.loadAsync(url(name))).scene),
				}))
			)
			const shared = models[0]?.material
			if (shared) sharedMaterials.push(shared)
			for (const { material } of models) if (material !== shared) material.dispose()
			return models.map((model) => ({ ...model, material: shared! }))
		}

		Promise.all([
			loadKit(placements, (name) => assetUrl(name as RoadAsset)),
			loadKit(buildings, (name) => buildingUrl(name as BuildingAsset)),
		]).then(([roadModels, buildingModels]) => {
			if (disposed) {
				// scene đã bị huỷ trong lúc đang tải
				for (const { geometry } of [...roadModels, ...buildingModels]) geometry.dispose()
				for (const material of sharedMaterials) material.dispose()
				return
			}
			const m = new THREE.Matrix4()
			const q = new THREE.Quaternion()
			const up = new THREE.Vector3(0, 1, 0)
			const scale = new THREE.Vector3(TILE, TILE, TILE)
			for (const { name, list, geometry, material } of [...roadModels, ...buildingModels]) {
				const mesh = new THREE.InstancedMesh(geometry, material, list.length)
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
			loading = false
			onload?.({
				assets: roadModels.length,
				instances: placements.length + buildings.length,
				buildings: buildings.length,
			})
		})

		return {
			update() {
				// đèn của scene đi theo mặt trời của bầu trời Nubis
				cloudscape?.applySunLight(sun, { intensity: 2.4, hemi, hemiIntensity: 1.6 })
				controls.update()
				if (labels) labelRenderer.render(scene, camera)
				stats.update()
			},
			resize(w, h) {
				labelRenderer.setSize(w, h)
			},
			dispose() {
				disposed = true
				stats.dom.remove()
				controls.dispose()
				for (const mesh of meshes) {
					mesh.geometry.dispose()
					mesh.dispose()
				}
				for (const material of sharedMaterials) material.dispose()
				for (const mesh of [ground, land]) {
					mesh.geometry.dispose()
					mesh.material.dispose()
				}
			},
		}
	}
</script>

<NubisSky params={skyParams} {setup} class={className}>
	<div bind:this={labelLayer} class="pointer-events-none absolute inset-0"></div>
	<div bind:this={statsHost} class="absolute top-2 left-2 z-10" aria-label="FPS"></div>
	{#if loading}
		<p
			class="absolute inset-0 grid place-items-center font-mono text-sm tracking-wide text-slate-200"
		>
			Đang tải model…
		</p>
	{/if}
</NubisSky>
