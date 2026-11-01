<script lang="ts">
	import FullscreenStage from '#lib/components/fullscreen-stage.svelte'
	import {
		CloudSky,
		defaultCloudParams,
		type CloudParams,
	} from '#lib/components/volumetric-cloud-2/index.js'
	import CloudInspector from './components/cloud-inspector.svelte'

	let params: CloudParams = $state({ ...defaultCloudParams })
</script>

<!-- canvas phủ toàn bộ màn hình dưới header, bảng điều khiển nổi bên phải -->
<FullscreenStage label="Mô phỏng mây thể tích">
	<CloudSky {params} class="h-full w-full" />
	<CloudInspector bind:params />
</FullscreenStage>
