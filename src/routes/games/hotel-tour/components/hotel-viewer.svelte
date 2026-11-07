<script lang="ts">
	import { onMount } from 'svelte'
	import * as THREE from 'three'
	import {
		CloudRenderer,
		NoiseTextures,
		defaultCloudParams,
		sunDirection,
		type CloudParams,
	} from '#lib/components/volumetric-cloud-2/index.js'
	import type { Area, AreaId } from './areas'
	import { buildArea, disposeGroup } from './build-area'
	import { EYE_HEIGHT, Walker } from './walker'

	let {
		areas,
		area,
		class: className = 'h-full w-full',
	}: { areas: Area[]; area: AreaId; class?: string } = $props()

	// buổi sáng nắng: mặt trời đã lên cao, từ phía biển chiếu vào
	const SKY: CloudParams = {
		...defaultCloudParams,
		coverage: 0.32,
		windSpeed: 12,
		sunElevation: 32,
		sunAzimuth: 160,
	}
	const SHORE_Z = -40

	let canvas: HTMLCanvasElement | null = null
	let progress = $state(0)
	let error = $state<string | null>(null)
	let locked = $state(false)
	let enterArea = $state.raw<((id: AreaId) => void) | null>(null)

	$effect(() => {
		enterArea?.(area)
	})

	onMount(() => {
		if (!canvas) return

		let renderer: THREE.WebGLRenderer
		try {
			renderer = new THREE.WebGLRenderer({
				canvas,
				antialias: true,
				powerPreference: 'high-performance',
			})
		} catch (e) {
			error = 'Không khởi tạo được WebGL2: ' + (e as Error).message
			return
		}
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
		renderer.shadowMap.enabled = true
		renderer.shadowMap.type = THREE.PCFShadowMap
		renderer.toneMapping = THREE.ACESFilmicToneMapping
		renderer.toneMappingExposure = 1.05
		renderer.debug.onShaderError = (gl, program, vs, fs) => {
			error =
				'Shader lỗi:\n' +
				(gl.getShaderInfoLog(fs) || '') +
				(gl.getShaderInfoLog(vs) || '') +
				(gl.getProgramInfoLog(program as unknown as globalThis.WebGLProgram) || '')
			renderer.setAnimationLoop(null)
		}

		const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 8000)
		const scene = new THREE.Scene()
		scene.fog = new THREE.Fog('#c8d8ea', 400, 7000)

		// ánh sáng khớp với mặt trời của bầu trời mây
		const sunDir = sunDirection(SKY.sunElevation, SKY.sunAzimuth)
		const sun = new THREE.DirectionalLight('#fff3e2', 3.2)
		sun.castShadow = true
		sun.shadow.mapSize.set(2048, 2048)
		sun.shadow.bias = -0.0004
		sun.shadow.normalBias = 0.03
		sun.shadow.radius = 3
		sun.shadow.camera.near = 1
		sun.shadow.camera.far = 220
		scene.add(sun, sun.target)
		scene.add(new THREE.HemisphereLight('#cfe3f7', '#e6dccb', 1.7))

		const groups = new Map(
			areas.map((a) => {
				const group = buildArea(a)
				group.visible = false
				scene.add(group)
				return [a.id, group] as const
			})
		)

		const walker = new Walker(camera, canvas)
		const onLock = () => (locked = true)
		const onUnlock = () => (locked = false)
		walker.controls.addEventListener('lock', onLock)
		walker.controls.addEventListener('unlock', onUnlock)
		const onClick = () => {
			if (!walker.locked && progress >= 1 && !error) walker.controls.lock()
		}
		canvas.addEventListener('click', onClick)

		const noise = new NoiseTextures(renderer)
		const clouds = new CloudRenderer(renderer, camera, noise, SKY, { ocean: { shoreZ: SHORE_Z } })

		enterArea = (id) => {
			const a = areas.find((x) => x.id === id)
			if (!a) return
			for (const [key, group] of groups) group.visible = key === id
			walker.colliders = a.colliders
			walker.place(a.spawn.x, a.floorY + EYE_HEIGHT, a.spawn.z, a.spawn.yaw)

			const cam = sun.shadow.camera
			cam.left = cam.bottom = -a.shadow.half
			cam.right = cam.top = a.shadow.half
			cam.updateProjectionMatrix()
			sun.target.position.set(a.shadow.cx, a.floorY, a.shadow.cz)
			sun.position.copy(sun.target.position).addScaledVector(sunDir, 120)
		}

		const resize = () => {
			const { clientWidth: w, clientHeight: h } = canvas!
			if (!w || !h) return
			renderer.setSize(w, h, false)
			camera.aspect = w / h
			camera.updateProjectionMatrix()
			const size = renderer.getDrawingBufferSize(new THREE.Vector2())
			clouds.setSize(size.x, size.y)
		}
		const observer = new ResizeObserver(resize)
		observer.observe(canvas)
		resize()

		const timer = new THREE.Timer()
		renderer.setAnimationLoop((now) => {
			timer.update(now)
			const dt = Math.min(0.1, timer.getDelta())

			// giai đoạn 1: tạo noise cho mây
			if (!noise.ready) {
				noise.bake()
				progress = noise.progress
				return
			}

			// giai đoạn 2: trời + mây + biển, rồi cảnh vẽ đè lên (trời ở vô cực nên không cần depth)
			walker.update(dt)
			camera.updateMatrixWorld()
			clouds.render(dt)
			renderer.autoClear = false
			renderer.clearDepth()
			renderer.render(scene, camera)
			renderer.autoClear = true
		})

		return () => {
			renderer.setAnimationLoop(null)
			observer.disconnect()
			canvas?.removeEventListener('click', onClick)
			walker.controls.removeEventListener('lock', onLock)
			walker.controls.removeEventListener('unlock', onUnlock)
			walker.dispose()
			for (const group of groups.values()) disposeGroup(group)
			clouds.dispose()
			noise.dispose()
			renderer.dispose()
			enterArea = null
		}
	})
</script>

<div class="relative overflow-hidden bg-black {className}">
	<canvas
		bind:this={canvas}
		aria-label="Khách sạn 3D: bấm để đi, chuột để nhìn, W A S D để di chuyển"
		class="block h-full w-full outline-none {locked ? 'cursor-none' : 'cursor-pointer'}"
	></canvas>

	{#if error || progress < 1}
		<div class="absolute inset-0 grid place-items-center bg-[#05070b] p-4 text-slate-200">
			<div class="w-full max-w-80 text-center text-sm">
				{#if error}
					<p class="font-semibold text-red-300">Lỗi</p>
					<pre
						class="mt-2 max-h-60 overflow-auto text-left font-mono text-xs whitespace-pre-wrap text-red-300">{error}</pre>
				{:else}
					<p>Đang chuẩn bị bầu trời…</p>
					<div class="mt-2.5 h-1 overflow-hidden rounded-full bg-slate-800">
						<div class="h-full bg-cyan-400" style:width="{(progress * 100).toFixed(1)}%"></div>
					</div>
				{/if}
			</div>
		</div>
	{:else if locked}
		<!-- tâm ngắm -->
		<div
			aria-hidden="true"
			class="pointer-events-none absolute top-1/2 left-1/2 size-1.5 -translate-1/2 rounded-full bg-white/80 ring-1 ring-black/30"
		></div>
	{:else}
		<div class="pointer-events-none absolute inset-x-0 bottom-6 grid place-items-center">
			<p
				class="rounded-xl bg-slate-950/70 px-5 py-3 text-center text-sm text-slate-100 shadow-xl backdrop-blur"
			>
				<span class="font-semibold">Bấm vào cảnh để bắt đầu tham quan</span><br />
				<span class="text-slate-300"
					>Chuột để nhìn · W A S D để đi · Shift đi nhanh · Esc để thoát</span
				>
			</p>
		</div>
	{/if}
</div>
