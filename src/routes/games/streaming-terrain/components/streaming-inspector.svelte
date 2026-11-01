<script lang="ts">
	import {
		defaultStreamingParams,
		type StreamingParams,
	} from '#lib/components/streaming-terrain/index.js'
	import {
		ControlGroup,
		InspectorPanel,
		RangeControl,
		ToggleControl,
	} from '#lib/components/inspector/index.js'
	import { STREAMING_RANGES, TERRAIN_RANGES, TILE_RANGES } from './controls'

	let {
		params = $bindable(),
		autoWalk = $bindable(),
		open = $bindable(true),
	}: { params: StreamingParams; autoWalk: boolean; open?: boolean } = $props()

	const groups = [
		{ title: 'Ô', note: 'đổi thì dựng lại mọi ô', controls: TILE_RANGES },
		{ title: 'Địa hình', note: 'đổi thì dựng lại mọi ô', controls: TERRAIN_RANGES },
	]
</script>

<InspectorPanel
	id="streaming-panel"
	eyebrow="World streaming"
	title="Streaming Terrain"
	bind:open
	onreset={() => (params = { ...defaultStreamingParams })}
>
	{#snippet description()}
		<p class="mt-1 text-sm leading-5 text-slate-400">
			Thế giới chia thành ô. Ô quanh nhân vật được nạp, gần trước, ô ra khỏi tầm bị huỷ. Mỗi model
			cây chỉ nạp một lần và vẽ bằng BatchedMesh cho mọi ô.
		</p>
		<p class="mt-2 text-xs leading-5 text-slate-500">
			Click vào cảnh rồi: <kbd>W A S D</kbd> / phím mũi tên để đi · <kbd>Shift</kbd> chạy · kéo để xoay
			camera · cuộn để zoom. Port từ SimonDev, Three.js course 03-05.
		</p>
	{/snippet}

	<ControlGroup title="Streaming" open>
		<ToggleControl label="Tự đi" note="(khi không bấm phím)" bind:checked={autoWalk} />
		<ToggleControl label="Tô màu từng ô" bind:checked={params.tintTiles} />
		{#each STREAMING_RANGES as c (c.key)}
			<RangeControl {...c} bind:value={params[c.key]} />
		{/each}
	</ControlGroup>

	{#each groups as group (group.title)}
		<ControlGroup title={group.title}>
			<p class="text-xs text-slate-500">{group.note}</p>
			{#each group.controls as c (c.key)}
				<RangeControl {...c} bind:value={params[c.key]} />
			{/each}
		</ControlGroup>
	{/each}
</InspectorPanel>
