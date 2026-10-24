<script lang="ts">
	import { onMount } from 'svelte'
	import { initGame } from './game'

	let canvasRef: HTMLCanvasElement | undefined

	onMount(() => {
		if (!canvasRef) return
		initGame(canvasRef)
	})
</script>

<div class="mx-auto h-192 w-5xl">
	<canvas bind:this={canvasRef} class="rounded border"></canvas>
</div>
