<script lang="ts">
	import { defaultGrassParams, type GrassParams } from '#lib/components/infinite-grass/index.js'
	import {
		ControlGroup,
		InspectorPanel,
		RangeControl,
		ToggleControl,
	} from '#lib/components/inspector/index.js'
	import { GRASS_RANGES, TERRAIN_RANGES, TRAMPLE_RANGES, WIND_RANGES } from './controls'

	let {
		params = $bindable(),
		autoWalk = $bindable(),
		open = $bindable(true),
	}: { params: GrassParams; autoWalk: boolean; open?: boolean } = $props()

	const groups = [
		{ title: 'Cỏ', controls: GRASS_RANGES },
		{ title: 'Địa hình', controls: TERRAIN_RANGES },
		{ title: 'Gió', controls: WIND_RANGES },
	]
</script>

<InspectorPanel
	id="grass-panel"
	eyebrow="Shader inspector"
	title="Infinite Grass"
	bind:open
	onreset={() => (params = { ...defaultGrassParams })}
>
	{#snippet description()}
		<p class="mt-1 text-sm leading-5 text-slate-400">
			Mỗi lá cỏ được dựng hoàn toàn trong vertex shader bằng instancing, một draw call cho cả đồng
			cỏ. Cỏ ngả ra khi nhân vật đi qua rồi từ từ đứng dậy.
		</p>
		<p class="mt-2 text-xs leading-5 text-slate-500">
			Click vào cảnh rồi: <kbd>W A S D</kbd> / phím mũi tên để đi · <kbd>Shift</kbd> chạy · kéo để xoay
			camera · cuộn để zoom. Port từ SimonDev, Quick Grass.
		</p>
	{/snippet}

	<ControlGroup title="Tương tác" open>
		<ToggleControl label="Tự đi vòng tròn" note="(khi không bấm phím)" bind:checked={autoWalk} />
		{#each TRAMPLE_RANGES as c (c.key)}
			<RangeControl {...c} bind:value={params[c.key]} />
		{/each}
	</ControlGroup>

	{#each groups as group (group.title)}
		<ControlGroup title={group.title}>
			{#each group.controls as c (c.key)}
				<RangeControl {...c} bind:value={params[c.key]} />
			{/each}
		</ControlGroup>
	{/each}
</InspectorPanel>
