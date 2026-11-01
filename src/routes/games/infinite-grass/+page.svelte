<script lang="ts">
	import FullscreenStage from '#lib/components/fullscreen-stage.svelte'
	import {
		GrassView,
		defaultGrassParams,
		type GrassParams,
	} from '#lib/components/infinite-grass/index.js'
	import GrassInspector from './components/grass-inspector.svelte'

	let params: GrassParams = $state({ ...defaultGrassParams })
</script>

<!-- canvas phủ toàn bộ màn hình dưới header, bảng điều khiển nổi bên phải -->
<FullscreenStage label="Đồng cỏ">
	<GrassView {params} class="h-full w-full" />
	<GrassInspector bind:params />
</FullscreenStage>
