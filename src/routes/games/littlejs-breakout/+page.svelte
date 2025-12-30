<script lang="ts">
	import { onMount } from 'svelte'

	import { initGame } from './components/game'

	let canvasContainer: HTMLDivElement | undefined

	onMount(async () => {
		if (!canvasContainer) return
		initGame(canvasContainer)
	})
</script>

<div bind:this={canvasContainer} class="relative h-[720px] w-[1280px]"></div>
