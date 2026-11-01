<script lang="ts">
	import FullscreenStage from '#lib/components/fullscreen-stage.svelte'
	import {
		GrassView,
		defaultGrassParams,
		type GrassParams,
	} from '#lib/components/infinite-grass/index.js'
	import GrassInspector from './components/grass-inspector.svelte'

	let params: GrassParams = $state({ ...defaultGrassParams })
	// mở trang là thấy cỏ bị đè ngay; bấm phím để tự điều khiển
	let autoWalk = $state(true)
</script>

<!-- canvas phủ toàn bộ màn hình dưới header, bảng điều khiển nổi bên phải -->
<FullscreenStage label="Đồng cỏ">
	<GrassView {params} {autoWalk} class="h-full w-full" />
	<GrassInspector bind:params bind:autoWalk />
</FullscreenStage>
