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
	} from 'postprocessing'
	import type { Camera } from 'three'

	const { scene, renderer, camera, size, autoRender, renderStage } = useThrelte()

	const composer = new EffectComposer(renderer)

	const setupEffectComposer = (camera: Camera) => {
		composer.removeAllPasses()
		composer.addPass(new RenderPass(scene, camera))
		composer.addPass(
			new EffectPass(
				camera,
				new BloomEffect({
					intensity: 1,
					luminanceThreshold: 0.15,
					height: 512,
					width: 512,
					luminanceSmoothing: 0.08,
					mipmapBlur: true,
					kernelSize: KernelSize.MEDIUM,
				})
			)
		)
		composer.addPass(
			new EffectPass(
				camera,
				new SMAAEffect({
					preset: SMAAPreset.LOW,
				})
			)
		)
	}

	$effect(() => {
		setupEffectComposer(camera.current)
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
				camera.current.quaternion.w
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
			composer.render(delta)
		},
		{ stage: renderStage, autoInvalidate: false }
	)
</script>
