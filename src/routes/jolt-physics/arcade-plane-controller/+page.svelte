<script lang="ts">
	import { Canvas } from '@threlte/core'
	import Scene from './components/scene.svelte'
</script>

<div class="mockup-window border-base-300 relative w-full border bg-amber-400">
	<div class="bg-gray-50">
		<Canvas shadows>
			<Scene />
		</Canvas>
	</div>

	<div
		class="pointer-events-none absolute top-4 left-4 rounded-md bg-black/55 px-3 py-2 text-xs text-white"
	>
		<div class="font-semibold">Controls</div>
		<div>`Shift`: throttle up</div>
		<div>`Ctrl`: throttle down</div>
		<div>`A` / `D`: turn</div>
		<div>`W` / `S`: pitch</div>
	</div>
</div>
