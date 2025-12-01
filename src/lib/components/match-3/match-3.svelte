<script lang="ts">
	import { onMount } from 'svelte'
	import kaplay from 'kaplay'

	let canvasRef: HTMLCanvasElement | undefined

	onMount(() => {
		kaplay({
			canvas: canvasRef,
		})
	})
</script>

<canvas bind:this={canvasRef} class="aspect-video w-full rounded border"></canvas>
