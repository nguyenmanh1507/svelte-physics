<script lang="ts">
	import { onMount } from 'svelte'
	import * as THREE from 'three'
	import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
	import { PlayerBall } from '#lib/components/infinite-grass/player.js'
	import { moveDirection, PlayerInput } from '#lib/components/infinite-grass/player-input.js'
	import type { StreamingParams } from './params'
	import { StreamingScene } from './streaming-scene'

	const WALK_SPEED = 6 // m/s
	const RUN_SPEED = 20 // m/s, giữ Shift: chạy nhanh để thấy ô nạp / huỷ
	const AUTO_SPEED = 5 // m/s, tự đi thẳng rồi lượn chậm
	const AUTO_TURN = 0.08 // rad/s
	const CAMERA_OFFSET = new THREE.Vector3(6, 5, 8) // vị trí camera ban đầu so với nhân vật

	let {
		params,
		autoWalk = false,
		class: className = 'aspect-video w-full rounded-lg',
	}: {
		params: StreamingParams
		autoWalk?: boolean // không bấm phím thì nhân vật tự đi
		class?: string
	} = $props()

	let canvas: HTMLCanvasElement | null = null
	let world = $state.raw<StreamingScene | null>(null)
	let error = $state<string | null>(null)
	let stats = $state<string[]>([])

	$effect(() => {
		const next = $state.snapshot(params) as StreamingParams
		world?.setParams(next)
	})

	onMount(() => {
		if (!canvas) return
		let disposed = false

		const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
		renderer.shadowMap.enabled = true
		renderer.shadowMap.type = THREE.PCFShadowMap
		renderer.toneMapping = THREE.ACESFilmicToneMapping

		const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000)
		const controls = new OrbitControls(camera, canvas)
		controls.enablePan = false // tâm xoay luôn là nhân vật
		controls.maxDistance = 60
		controls.maxPolarAngle = Math.PI * 0.48 // không chui xuống đất
		const input = new PlayerInput(canvas)
		const player = new PlayerBall(0.4)

		const resize = () => {
			const { clientWidth: w, clientHeight: h } = canvas!
			if (!w || !h) return
			renderer.setSize(w, h, false)
			camera.aspect = w / h
			camera.updateProjectionMatrix()
		}
		const observer = new ResizeObserver(resize)
		observer.observe(canvas)
		resize()

		StreamingScene.create(renderer, camera, $state.snapshot(params) as StreamingParams)
			.then((scene) => {
				if (disposed) return scene.dispose()
				world = scene
				start(scene)
			})
			.catch((e: Error) => (error = 'Không tải được bầu trời: ' + e.message))

		function start(scene: StreamingScene) {
			const groundHeight = (x: number, z: number) => scene.heightAt(x, z)
			player.update(0, new THREE.Vector2(), 0, groundHeight)
			player.mesh.castShadow = true
			scene.scene.add(player.mesh)
			camera.position.copy(player.position).add(CAMERA_OFFSET)
			controls.target.copy(player.position)
			controls.update()

			const move = new THREE.Vector2()
			const forward = new THREE.Vector3()
			const before = new THREE.Vector3()
			let autoTime = 0

			const timer = new THREE.Timer()
			let fpsTime = 0
			let fpsFrames = 0
			renderer.setAnimationLoop((now) => {
				timer.update(now)
				const delta = timer.getDelta()
				const dt = Math.min(0.1, delta)

				camera.getWorldDirection(forward)
				moveDirection(input.keys, forward, move)
				let speed = input.running ? RUN_SPEED : WALK_SPEED
				if (move.lengthSq() === 0 && autoWalk) {
					autoTime += dt
					const angle = Math.sin(autoTime * AUTO_TURN) * 1.5
					move.set(Math.sin(angle), -Math.cos(angle))
					speed = AUTO_SPEED
				}
				before.copy(player.position)
				player.update(dt, move, speed, groundHeight)

				// camera đi theo nhân vật, vẫn xoay / zoom quanh nó bằng chuột được
				camera.position.add(before.subVectors(player.position, before))
				// giữ camera trên mặt đất khi lên dốc
				const minY = scene.heightAt(camera.position.x, camera.position.z) + 0.5
				if (camera.position.y < minY) camera.position.y = minY
				controls.target.copy(player.position)
				controls.update()

				scene.update(player.position)
				renderer.render(scene.scene, camera)

				// thời gian thật (không kẹp) để số liệu vẫn cập nhật khi frame chậm
				fpsTime += delta
				fpsFrames++
				if (fpsTime > 0.5) {
					const s = scene.world.stats
					stats = [
						`${(fpsFrames / fpsTime).toFixed(0)} fps · ${renderer.info.render.calls} draw call`,
						`ô: ${s.ready} sẵn sàng · ${s.loading} đang nạp · ${s.queued} chờ`,
						`model: ${s.assets.loaded} đã nạp · ${s.assets.loading} đang nạp`,
					]
					fpsTime = fpsFrames = 0
				}
			})
		}

		return () => {
			disposed = true
			renderer.setAnimationLoop(null)
			observer.disconnect()
			controls.dispose()
			input.dispose()
			player.dispose()
			world?.dispose()
			world = null
			renderer.dispose()
		}
	})
</script>

<div class="relative overflow-hidden bg-black {className}">
	<canvas
		bind:this={canvas}
		aria-label="Thế giới streaming: W A S D để đi, Shift để chạy, kéo để xoay camera, cuộn để zoom"
		class="block h-full w-full cursor-grab touch-none outline-none active:cursor-grabbing"
	></canvas>

	{#if error || !world}
		<div class="absolute inset-0 grid place-items-center bg-slate-950 p-4 text-slate-200">
			<div class="w-full max-w-80 text-center text-sm">
				{#if error}
					<p class="font-semibold text-red-300">Lỗi</p>
					<pre
						class="mt-2 max-h-60 overflow-auto text-left font-mono text-xs whitespace-pre-wrap text-red-300">{error}</pre>
				{:else}
					<p>Đang tải bầu trời…</p>
				{/if}
			</div>
		</div>
	{:else if stats.length}
		<div
			class="absolute bottom-2 left-2 rounded-md bg-slate-950/80 px-2 py-1 font-mono text-xs leading-5 text-slate-400"
		>
			{#each stats as line (line)}
				<p>{line}</p>
			{/each}
		</div>
	{/if}
</div>
