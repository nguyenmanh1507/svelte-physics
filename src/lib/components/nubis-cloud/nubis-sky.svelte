<script lang="ts" module>
	import type { NubisCloudscape as Cloudscape } from './nubis-cloudscape'
	import type * as THREE from 'three/webgpu'

	export type NubisSkyContext = {
		renderer: THREE.WebGPURenderer
		scene: THREE.Scene
		camera: THREE.PerspectiveCamera
		canvas: HTMLCanvasElement
		cloudscape: Cloudscape | null // null khi trình duyệt không có WebGPU
	}

	// setup() trả về các hook này để component gọi trong vòng lặp
	export type NubisSceneHooks = {
		update?: (delta: number) => void
		resize?: (width: number, height: number) => void
		dispose?: () => void
	}
</script>

<script lang="ts">
	import { onMount, type Snippet } from 'svelte'
	import { PerspectiveCamera, Scene, Timer, WebGPURenderer } from 'three/webgpu'
	import { NubisLightShafts, type LightShaftParams } from './light-shafts'
	import { NubisCloudscape } from './nubis-cloudscape'
	import type { NubisParams } from './params'

	let {
		params = {},
		setup,
		class: className = 'aspect-square w-full rounded-lg bg-slate-900',
		maxPixelRatio = 1.5,
		lightShafts = false,
		children,
	}: {
		params?: Partial<NubisParams>
		setup: (ctx: NubisSkyContext) => NubisSceneHooks | void
		class?: string
		maxPixelRatio?: number
		lightShafts?: Partial<LightShaftParams> | false // tia nắng xuyên mây, false = không tạo pass
		children?: Snippet
	} = $props()

	let container: HTMLDivElement | null = null
	let canvas: HTMLCanvasElement | null = null
	let status = $state<string | null>('Đang khởi động WebGPU…')
	let cloudscape = $state.raw<NubisCloudscape | null>(null)

	// đổi params -> ghi vào uniform, weather map chỉ sinh lại khi cần
	$effect(() => {
		const next = $state.snapshot(params) as Partial<NubisParams>
		cloudscape?.setParams(next)
	})

	// tia nắng là pass phụ của cloudscape: tạo / bỏ / cập nhật theo prop (cloudscape.dispose giải phóng nó)
	let shafts: NubisLightShafts | null = null
	$effect(() => {
		const config =
			lightShafts === false ? null : ($state.snapshot(lightShafts) as Partial<LightShaftParams>)
		if (!cloudscape) return
		if (config && !shafts) {
			shafts = new NubisLightShafts(cloudscape, config)
			cloudscape.addPass(shafts)
		} else if (!config && shafts) {
			cloudscape.removePass(shafts)
			shafts.dispose()
			shafts = null
		} else if (config && shafts) shafts.setParams(config)
	})

	onMount(() => {
		if (!container || !canvas) return
		const el = container
		let disposed = false
		let hooks: NubisSceneHooks | void
		let observer: ResizeObserver | null = null

		const renderer = new WebGPURenderer({ canvas, antialias: false })
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio))
		// mất GPU device (driver reset, watchdog...) -> dừng vòng lặp thay vì báo lỗi mỗi frame
		renderer.onDeviceLost = (info) => {
			console.error('Nubis: GPU device lost', info)
			renderer.setAnimationLoop(null)
			if (!disposed) status = `Mất GPU device: ${info.message}`
		}
		const scene = new Scene()
		const camera = new PerspectiveCamera(60, 1, 0.5, 200_000)

		async function start() {
			await renderer.init()
			if (disposed) return

			const resize = () => {
				const { clientWidth: w, clientHeight: h } = el
				renderer.setSize(w, h)
				camera.aspect = w / h
				camera.updateProjectionMatrix()
				cloudscape?.setSize()
				hooks?.resize?.(w, h)
			}
			resize()

			// Shader mây viết bằng WGSL nên cần backend WebGPU thật, không chạy trên WebGL2 fallback.
			const webgpu = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend === true
			const clouds = webgpu ? new NubisCloudscape(renderer, $state.snapshot(params)) : null
			cloudscape = clouds

			hooks = setup({ renderer, scene, camera, canvas: canvas!, cloudscape: clouds })
			resize()
			observer = new ResizeObserver(resize)
			observer.observe(el)

			const timer = new Timer()
			renderer.setAnimationLoop(() => {
				timer.update()
				const dt = Math.min(timer.getDelta(), 0.1)
				hooks?.update?.(dt)
				if (clouds) clouds.render(scene, camera, dt)
				else renderer.render(scene, camera)
			})

			if (!clouds) {
				status = 'WebGPU không khả dụng – đã tắt mây thể tích'
				return
			}
			status = 'Đang tạo noise texture…'
			await clouds.init()
			if (!disposed) status = null
		}

		start().catch((error: Error) => {
			console.error(error)
			if (!disposed) status = `Lỗi: ${error.message}`
		})

		return () => {
			disposed = true
			renderer.setAnimationLoop(null)
			observer?.disconnect()
			hooks?.dispose?.()
			cloudscape?.dispose()
			cloudscape = null
			shafts = null
			renderer.dispose()
		}
	})
</script>

<div bind:this={container} class="relative overflow-hidden {className}">
	<canvas bind:this={canvas} class="block h-full w-full"></canvas>
	{@render children?.()}
	{#if status}
		<p
			class="pointer-events-none absolute bottom-2 left-2 rounded bg-slate-950/80 px-2 py-1 font-mono text-xs text-slate-200"
		>
			{status}
		</p>
	{/if}
</div>
