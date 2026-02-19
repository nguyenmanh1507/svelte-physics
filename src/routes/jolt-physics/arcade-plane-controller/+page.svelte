<script lang="ts">
	import { Canvas } from '@threlte/core'
	import Scene from './components/scene.svelte'
</script>

<div class="mockup-window border-base-300 w-full border bg-amber-400">
	<div class="bg-gray-50">
		<Canvas shadows>
			<Scene />
		</Canvas>
	</div>
</div>
