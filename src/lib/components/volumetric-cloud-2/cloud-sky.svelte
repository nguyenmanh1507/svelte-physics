<script lang="ts">
	import { onMount } from 'svelte'
	import * as THREE from 'three'
	import { CloudRenderer } from './cloud-renderer'
	import { FlyControls } from './fly-controls'
	import { NoiseTextures } from './noise-textures'
	import type { CloudParams } from './params'

	let {
		params,
		class: className = 'aspect-video w-full rounded-lg',
	}: { params: CloudParams; class?: string } = $props()

	let canvas: HTMLCanvasElement | null = null
	let clouds = $state.raw<CloudRenderer | null>(null)
	let progress = $state(0)
	let error = $state<string | null>(null)
	let stats = $state('')

	// đổi params -> ghi vào uniform (renderScale thì đổi kích thước pass mây)
	$effect(() => {
		const next = $state.snapshot(params) as CloudParams
		clouds?.setParams(next)
	})

	onMount(() => {
		if (!canvas) return

		let renderer: THREE.WebGLRenderer
		try {
			renderer = new THREE.WebGLRenderer({
				canvas,
				antialias: false,
				powerPreference: 'high-performance',
			})
		} catch (e) {
			error = 'Không khởi tạo được WebGL2: ' + (e as Error).message
			return
		}
		// pass mây đã chạy ở độ phân giải thấp, pixel ratio 1 giữ composite nhẹ
		renderer.setPixelRatio(1)
		renderer.debug.onShaderError = (gl, program, vs, fs) => {
			error =
				'Shader lỗi:\n' +
				(gl.getShaderInfoLog(fs) || '') +
				(gl.getShaderInfoLog(vs) || '') +
				// types của three gõ `program` là class WebGLProgram của nó, thực tế là program của GL
				(gl.getProgramInfoLog(program as unknown as globalThis.WebGLProgram) || '')
			renderer.setAnimationLoop(null)
		}

		// đơn vị mét, bắt đầu ở độ cao 30 m
		const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 10)
		camera.position.set(0, 30, 0)
		const controls = new FlyControls(camera, canvas)
		const noise = new NoiseTextures(renderer)
		const cloudRenderer = new CloudRenderer(renderer, camera, noise, $state.snapshot(params))
		clouds = cloudRenderer

		const resize = () => {
			const { clientWidth: w, clientHeight: h } = canvas!
			if (!w || !h) return
			renderer.setSize(w, h, false)
			camera.aspect = w / h
			camera.updateProjectionMatrix()
			cloudRenderer.setSize(w, h)
		}
		const observer = new ResizeObserver(resize)
		observer.observe(canvas)
		resize()

		const timer = new THREE.Timer()
		let fpsTime = 0
		let fpsFrames = 0
		renderer.setAnimationLoop((now) => {
			timer.update(now)
			const dt = Math.min(0.1, timer.getDelta())

			// giai đoạn 1: tạo noise
			if (!noise.ready) {
				noise.bake()
				progress = noise.progress
				return
			}

			// giai đoạn 2: render
			controls.update(dt)
			cloudRenderer.render(dt)

			fpsTime += dt
			fpsFrames++
			if (fpsTime > 0.5) {
				const [w, h] = cloudRenderer.cloudSize
				const altitude = camera.position.y.toFixed(0)
				stats = `${(fpsFrames / fpsTime).toFixed(0)} fps · mây ${w}×${h} · cao ${altitude} m`
				fpsTime = fpsFrames = 0
			}
		})

		return () => {
			renderer.setAnimationLoop(null)
			observer.disconnect()
			controls.dispose()
			cloudRenderer.dispose()
			noise.dispose()
			renderer.dispose()
			clouds = null
		}
	})
</script>

<div class="relative overflow-hidden bg-black {className}">
	<canvas
		bind:this={canvas}
		aria-label="Bầu trời: kéo để nhìn, W A S D / E Q để bay"
		class="block h-full w-full cursor-grab touch-none outline-none active:cursor-grabbing"
	></canvas>

	{#if error || progress < 1}
		<div class="absolute inset-0 grid place-items-center bg-[#05070b] p-4 text-slate-200">
			<div class="w-full max-w-80 text-center text-sm">
				{#if error}
					<p class="font-semibold text-red-300">Lỗi</p>
					<pre
						class="mt-2 max-h-60 overflow-auto text-left font-mono text-xs whitespace-pre-wrap text-red-300">{error}</pre>
				{:else}
					<p>Đang tạo noise trên GPU…</p>
					<div class="mt-2.5 h-1 overflow-hidden rounded-full bg-slate-800">
						<div class="h-full bg-cyan-400" style:width="{(progress * 100).toFixed(1)}%"></div>
					</div>
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
