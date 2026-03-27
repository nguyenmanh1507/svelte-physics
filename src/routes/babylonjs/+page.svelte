<script lang="ts">
	import { onMount } from 'svelte'
	import {
		Engine,
		Scene,
		ArcRotateCamera,
		HemisphericLight,
		MeshBuilder,
		StandardMaterial,
		Vector3,
		Color3,
	} from '@babylonjs/core'

	let canvas: HTMLCanvasElement | undefined

	onMount(() => {
		if (!canvas) return

		// Engine
		const engine = new Engine(canvas, true)
		engine.resize()

		// Scene
		const scene = new Scene(engine)

		// Camera
		const camera = new ArcRotateCamera(
			'camera',
			-Math.PI / 2,
			Math.PI / 3,
			8,
			Vector3.Zero(),
			scene
		)
		camera.attachControl(false)

		// Light
		new HemisphericLight('light', Vector3.Up(), scene)

		// Box
		const box = MeshBuilder.CreateBox('box', { size: 1 }, scene)
		box.position.y = 1
		const boxMat = new StandardMaterial('boxMat', scene)
		boxMat.diffuseColor = new Color3(0.39, 0.58, 0.93)
		box.material = boxMat

		// Ground
		const ground = MeshBuilder.CreateGround('ground', { width: 6, height: 6 }, scene)
		const groundMat = new StandardMaterial('groundMat', scene)
		groundMat.diffuseColor = new Color3(0.5, 0.5, 0.5)
		ground.material = groundMat

		// Resize listener
		const resizeHandler = () => engine.resize()
		window.addEventListener('resize', resizeHandler)

		// Render loop
		engine.runRenderLoop(() => {
			box.rotation.y += 0.01
			scene.render()
		})

		return () => {
			window.removeEventListener('resize', resizeHandler)
			engine.stopRenderLoop()
			engine.dispose()
		}
	})
</script>

<svelte:head>
	<title>BabylonJS</title>
</svelte:head>

<div class="mockup-window border-base-300 relative w-full border bg-amber-400">
	<canvas class="aspect-video w-full" bind:this={canvas}></canvas>
</div>
