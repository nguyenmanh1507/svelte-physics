<script lang="ts">
	import { useThrelte, useTask } from '@threlte/core'
	import { onMount } from 'svelte'
	import {
		EffectComposer,
		EffectPass,
		RenderPass,
		SMAAEffect,
		SMAAPreset,
		BloomEffect,
		KernelSize,
		GlitchEffect,
		DotScreenEffect,
		GlitchMode,
		ChromaticAberrationEffect,
	} from 'postprocessing'
	import { Vector2, type Camera } from 'three'
	import { Pane, Checkbox } from 'svelte-tweakpane-ui'

	const { scene, renderer, camera, size, autoRender, renderStage } = useThrelte()

	const composer = new EffectComposer(renderer)

	// Effect state toggles
	let enabledPostprocessing = $state(true)
	let enabledBloom = $state(false)
	let enabledSMAA = $state(true)
	let enabledDotScreen = $state(false)
	let enabledGlitch = $state(false)
	let enabledRGBShift = $state(true)

	// Effects
	const bloomEffect = new BloomEffect({
		intensity: 1,
		luminanceThreshold: 0.15,
		height: 512,
		width: 512,
		luminanceSmoothing: 0.08,
		mipmapBlur: true,
		kernelSize: KernelSize.MEDIUM,
	})
	const smaaEffect = new SMAAEffect({
		preset: SMAAPreset.LOW,
	})
	const dotScreenEffect = new DotScreenEffect()
	const glitchEffect = new GlitchEffect()
	const chromaticAberrationEffect = new ChromaticAberrationEffect({
		offset: new Vector2(0.002, 0.001),
		radialModulation: false,
		modulationOffset: 0.5,
	})
	type EffectToggleConfig = {
		bloom: boolean
		smaa: boolean
		dotScreen: boolean
		glitch: boolean
		rgbShift: boolean
	}

	const setupEffectComposer = (camera: Camera, config: EffectToggleConfig) => {
		composer.removeAllPasses()
		composer.addPass(new RenderPass(scene, camera))

		if (config.bloom) {
			composer.addPass(new EffectPass(camera, bloomEffect))
		}
		if (config.smaa) {
			composer.addPass(new EffectPass(camera, smaaEffect))
		}
		if (config.dotScreen) {
			composer.addPass(new EffectPass(camera, dotScreenEffect))
		}
		if (config.glitch) {
			glitchEffect.mode = GlitchMode.CONSTANT_WILD
			composer.addPass(new EffectPass(camera, glitchEffect))
		}
		if (config.rgbShift) {
			composer.addPass(new EffectPass(camera, chromaticAberrationEffect))
		}
	}

	// Rebuild composer when camera/effect toggles change.
	// NOTE: `camera.current` may be undefined early during init, so guard it.
	$effect(() => {
		const currentCamera = camera.current
		if (!currentCamera) return

		// Only rebuild the postprocessing pipeline when it's enabled.
		// When disabled we bypass the composer entirely in the render loop.
		if (enabledPostprocessing) {
			setupEffectComposer(currentCamera, {
				bloom: enabledBloom,
				smaa: enabledSMAA,
				dotScreen: enabledDotScreen,
				glitch: enabledGlitch,
				rgbShift: enabledRGBShift,
			})
		}
	})

	$effect(() => {
		composer.setSize(size.current.width, size.current.height)
	})

	onMount(() => {
		let before = autoRender.current
		autoRender.set(false)
		return () => autoRender.set(before)
	})

	onMount(() => {
		const logCamera = () => {
			if (!camera.current) return
			const pos = camera.current.position
			const rot = camera.current.rotation
			console.log('Camera Position:', [pos.x, pos.y, pos.z])
			console.log('Camera Rotation:', [rot.x, rot.y, rot.z])
			console.log('Camera Quaternion:', [
				camera.current.quaternion.x,
				camera.current.quaternion.y,
				camera.current.quaternion.z,
				camera.current.quaternion.w,
			])
		}

		window.addEventListener('keydown', (e) => {
			if (e.key === 'c' || e.key === 'C') {
				logCamera()
			}
		})
	})

	useTask(
		(delta) => {
			const currentCamera = camera.current
			if (!currentCamera) return

			if (enabledPostprocessing) {
				composer.render(delta)
			} else {
				renderer.render(scene, currentCamera)
			}
		},
		{ stage: renderStage, autoInvalidate: false }
	)
</script>

<Pane title="Post Processing Effects" position="fixed" y={80}>
	<Checkbox label="Enabled" bind:value={enabledPostprocessing} />
	<Checkbox label="Bloom" bind:value={enabledBloom} />
	<Checkbox label="SMAA" bind:value={enabledSMAA} />
	<Checkbox label="Dot Screen" bind:value={enabledDotScreen} />
	<Checkbox label="Glitch" bind:value={enabledGlitch} />
	<Checkbox label="Chromatic Aberration" bind:value={enabledRGBShift} />
</Pane>
