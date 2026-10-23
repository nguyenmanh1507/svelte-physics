<script lang="ts">
	import { onMount } from 'svelte'

	import { App } from './components/App'

	let canvas: HTMLCanvasElement | undefined

	onMount(() => {
		if (!canvas) return

		const app = new App(canvas)

		app.initialize()

		return () => {
			app.cleanup()
		}
	})
</script>

<svelte:head>
	<title>BabylonJS</title>
</svelte:head>

<div class="mockup-window border-base-300 relative w-full border bg-amber-400">
	<div class="aspect-video w-full bg-gray-50">
		<canvas bind:this={canvas} class="h-full w-full"></canvas>
	</div>
</div>
