<script lang="ts">
	import { onMount } from 'svelte'
	import * as THREE from 'three'
	import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
	import { GROUND_SIZE } from './ground'
	import { GrassScene } from './grass-scene'
	import type { GrassParams } from './params'
	import { PlayerBall } from './player'
	import { moveDirection, PlayerInput } from './player-input'

	const WALK_SPEED = 5 // m/s
	const RUN_SPEED = 12 // m/s, giữ Shift
	const AUTO_SPEED = 3 // m/s, tự đi vòng tròn bán kính AUTO_SPEED / AUTO_TURN
	const AUTO_TURN = 0.3 // rad/s
	const CAMERA_OFFSET = new THREE.Vector3(7, 4, 7) // vị trí camera ban đầu so với nhân vật

	let {
		params,
		autoWalk = false,
		class: className = 'aspect-video w-full rounded-lg',
	}: {
		params: GrassParams
		autoWalk?: boolean // không bấm phím thì nhân vật tự đi vòng tròn
		class?: string
	} = $props()

	let canvas: HTMLCanvasElement | null = null
	let world = $state.raw<GrassScene | null>(null)
	let error = $state<string | null>(null)
	let stats = $state('')

	const player = new PlayerBall()
	player.bounds = GROUND_SIZE / 2 - 10

	// đổi params -> ghi vào uniform / geometry của scene
	$effect(() => {
		const next = $state.snapshot(params) as GrassParams
		world?.setParams(next)
		player.trampleRadius = next.trampleRadius
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
		const controls = new OrbitControls(camera, canvas)
		controls.maxDistance = 2000 // giữ camera trong vòm trời (bán kính 5 000)
		controls.enablePan = false // tâm xoay luôn là nhân vật
		const input = new PlayerInput(canvas)

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
			const groundHeight = (x: number, z: number) => scene.heightAt(x, z)

			// nhân vật đứng giữa vùng cỏ, camera nhìn theo nó
			player.position.set(0, 0, 0)
			player.update(0, new THREE.Vector2(), 0, groundHeight)
			scene.scene.add(player.mesh)
			scene.addInteractor(player)
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
				const dt = Math.min(0.1, timer.getDelta())

				// phím đi theo hướng nhìn của camera; không bấm phím thì có thể tự đi vòng tròn
				camera.getWorldDirection(forward)
				moveDirection(input.keys, forward, move)
				let speed = input.running ? RUN_SPEED : WALK_SPEED
				if (move.lengthSq() === 0 && autoWalk) {
					autoTime += dt
					move.set(Math.cos(autoTime * AUTO_TURN), Math.sin(autoTime * AUTO_TURN))
					speed = AUTO_SPEED
				}
				before.copy(player.position)
				player.update(dt, move, speed, groundHeight)

				// camera đi theo nhân vật, vẫn xoay / zoom quanh nó bằng chuột được
				camera.position.add(before.subVectors(player.position, before))
				controls.target.copy(player.position)
				controls.update()

				scene.update(dt, renderer)
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
		aria-label="Đồng cỏ: W A S D để đi, kéo để xoay camera, cuộn để zoom"
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
