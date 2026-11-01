<script lang="ts">
	import FullscreenStage from '#lib/components/fullscreen-stage.svelte'
	import {
		StreamingView,
		defaultStreamingParams,
		type StreamingParams,
	} from '#lib/components/streaming-terrain/index.js'
	import StreamingInspector from './components/streaming-inspector.svelte'

	let params: StreamingParams = $state({ ...defaultStreamingParams })
	// mở trang là thấy ô được nạp / huỷ ngay; bấm phím để tự điều khiển
	let autoWalk = $state(true)
</script>

<FullscreenStage label="Thế giới streaming">
	<StreamingView {params} {autoWalk} class="h-full w-full" />
	<StreamingInspector bind:params bind:autoWalk />
</FullscreenStage>
