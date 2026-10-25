<script lang="ts">
	import { onMount } from 'svelte'
	import * as THREE from 'three'
	import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
	import type { VolumeParams } from './params'

	import vertexShader from './shaders/volume.vert?raw'
	import common from './shaders/common.glsl?raw'
	import step1 from './shaders/step1.frag?raw'
	import step2 from './shaders/step2.frag?raw'
	import step3 from './shaders/step3.frag?raw'
	import step4 from './shaders/step4.frag?raw'
	import step5 from './shaders/step5.frag?raw'
	import noise from './shaders/noise.glsl?raw'

	// bước 5 dùng noise chung với mây trong scene (cloud.frag)
	const steps = [step1, step2, step3, step4, noise + step5]
	let { step, params }: { step: number; params: VolumeParams } = $props()
	let canvas: HTMLCanvasElement | null = null

	const background = new THREE.Color().setRGB(0.572, 0.772, 0.921)
	const material = new THREE.ShaderMaterial({
		vertexShader,
		fragmentShader: common + steps[0],
		side: THREE.BackSide, // vẫn vẽ được khi camera chui vào trong hộp
		uniforms: {
			uBackground: { value: background },
			uScatterColor: { value: new THREE.Color().setRGB(0.8, 0.1, 0.5) },
			uLightDir: { value: new THREE.Vector3(0, 1, 0) },
			uLightColor: { value: new THREE.Color(1, 1, 1) },
			uSigmaA: { value: 0 },
			uSigmaS: { value: 0 },
			uG: { value: 0 },
			uNoiseScale: { value: 1 },
			uTime: { value: 0 },
			uSteps: { value: 1 },
			uLightSteps: { value: 1 },
		},
	})

	// Đổi bước -> đổi fragment shader và biên dịch lại.
	$effect(() => {
		material.fragmentShader = common + steps[step - 1]
		material.needsUpdate = true
	})

	// Đổi slider -> ghi vào uniform. Không cần biên dịch lại.
	$effect(() => {
		const u = material.uniforms
		u.uSigmaA.value = params.sigmaA
		u.uSigmaS.value = params.sigmaS
		u.uG.value = params.g
		u.uNoiseScale.value = params.noiseScale
		u.uSteps.value = params.steps
		u.uLightSteps.value = params.lightSteps
		u.uLightColor.value.setScalar(params.lightIntensity)

		const az = THREE.MathUtils.degToRad(params.lightAzimuth)
		const el = THREE.MathUtils.degToRad(params.lightElevation)
		u.uLightDir.value.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az))
	})

	onMount(() => {
		if (!canvas) return

		const renderer = new THREE.WebGLRenderer({
			canvas,
			antialias: true,
		})
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

		const scene = new THREE.Scene()
		scene.background = background

		const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
		camera.position.set(0, 0, 4)

		// Hộp bao quanh quả cầu bán kính 1. Hộp chỉ là "màn chiếu" cho shader.
		const box = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.2), material)
		scene.add(box)

		const controls = new OrbitControls(camera, canvas)
		controls.enableDamping = true

		const resize = () => {
			if (!canvas) return
			const { clientWidth: w, clientHeight: h } = canvas.parentElement!
			renderer.setSize(w, h)
			camera.aspect = w / h
			camera.updateProjectionMatrix()
		}

		const observer = new ResizeObserver(resize)
		observer.observe(canvas.parentElement!)
		resize()

		const timer = new THREE.Timer()
		renderer.setAnimationLoop(() => {
			timer.update()
			material.uniforms.uTime.value = timer.getElapsed()
			controls.update()
			renderer.render(scene, camera)
		})

		return () => {
			renderer.setAnimationLoop(null)
			observer.disconnect()
			controls.dispose()
			box.geometry.dispose()
			material.dispose()
			renderer.dispose()
		}
	})
</script>

<div class="mx-auto aspect-square w-full max-w-200 overflow-hidden rounded-lg bg-slate-900">
	<canvas bind:this={canvas} class="block h-full w-full"></canvas>
</div>
