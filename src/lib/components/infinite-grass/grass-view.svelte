<script lang="ts">
	import { onMount } from 'svelte'
	import * as THREE from 'three'
	import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
	import { GrassScene } from './grass-scene'
	import type { GrassParams } from './params'

	let {
		params,
		class: className = 'aspect-video w-full rounded-lg',
	}: { params: GrassParams; class?: string } = $props()

	let canvas: HTMLCanvasElement | null = null
	let world = $state.raw<GrassScene | null>(null)
	let error = $state<string | null>(null)
	let stats = $state('')

	// đổi params -> ghi vào uniform / geometry của scene
	$effect(() => {
		const next = $state.snapshot(params) as GrassParams
		world?.setParams(next)
	})

	onMount(() => {
		if (!canvas) return
		let disposed = false

		const renderer = new THREE.WebGLRenderer({ canvas, powerPreference: 'high-performance' })
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
		renderer.debug.onShaderError = (gl, program, vs, fs) => {
			error =
				'Shader lỗi:\n' +
				(gl.getShaderInfoLog(fs) || '') +
				(gl.getShaderInfoLog(vs) || '') +
				// types của three gõ `program` là class WebGLProgram của nó, thực tế là program của GL
				(gl.getProgramInfoLog(program as unknown as globalThis.WebGLProgram) || '')
			renderer.setAnimationLoop(null)
		}

		const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 10000)
		camera.position.set(10, 5, 5)
		const controls = new OrbitControls(camera, canvas)
		controls.maxDistance = 2000 // giữ camera trong vòm trời (bán kính 5 000)
		controls.update()

		const resize = () => {
			const { clientWidth: w, clientHeight: h } = canvas!
			if (!w || !h) return
			renderer.setSize(w, h, false)
			camera.aspect = w / h
			camera.updateProjectionMatrix()
			const size = renderer.getDrawingBufferSize(new THREE.Vector2())
			world?.setSize(size.x, size.y)
		}
		const observer = new ResizeObserver(resize)
		observer.observe(canvas)

		GrassScene.create($state.snapshot(params) as GrassParams)
			.then((scene) => {
				if (disposed) return scene.dispose()
				world = scene
				resize()
				start(scene)
			})
			.catch((e: Error) => (error = 'Không tải được texture: ' + e.message))

		function start(scene: GrassScene) {
			const timer = new THREE.Timer()
			let fpsTime = 0
			let fpsFrames = 0
			renderer.setAnimationLoop((now) => {
				timer.update(now)
				const dt = Math.min(0.1, timer.getDelta())
				scene.update(dt)
				renderer.render(scene.scene, camera)

				fpsTime += dt
				fpsFrames++
				if (fpsTime > 0.5) {
					const blades = scene.params.bladeCount.toLocaleString('vi-VN')
					stats = `${(fpsFrames / fpsTime).toFixed(0)} fps · ${blades} lá cỏ`
					fpsTime = fpsFrames = 0
				}
			})
		}

		return () => {
			disposed = true
			renderer.setAnimationLoop(null)
			observer.disconnect()
			controls.dispose()
			world?.dispose()
			world = null
			renderer.dispose()
		}
	})
</script>

<div class="relative overflow-hidden bg-black {className}">
	<canvas
		bind:this={canvas}
		aria-label="Đồng cỏ: kéo để xoay, cuộn để zoom"
		class="block h-full w-full cursor-grab touch-none active:cursor-grabbing"
	></canvas>

	{#if error || !world}
		<div class="absolute inset-0 grid place-items-center bg-slate-950 p-4 text-slate-200">
			<div class="w-full max-w-80 text-center text-sm">
				{#if error}
					<p class="font-semibold text-red-300">Lỗi</p>
					<pre
						class="mt-2 max-h-60 overflow-auto text-left font-mono text-xs whitespace-pre-wrap text-red-300">{error}</pre>
				{:else}
					<p>Đang tải texture…</p>
				{/if}
			</div>
		</div>
	{:else if stats}
		<p
			class="absolute bottom-2 left-2 rounded-md bg-slate-950/80 px-2 py-1 font-mono text-xs text-slate-400"
		>
			{stats}
		</p>
	{/if}
</div>
