<script lang="ts">
	import { defaultGrassParams, type GrassParams } from '#lib/components/infinite-grass/index.js'
	import { ControlGroup, InspectorPanel, RangeControl } from '#lib/components/inspector/index.js'
	import { GRASS_RANGES, TERRAIN_RANGES, WIND_RANGES } from './controls'

	let { params = $bindable(), open = $bindable(true) }: { params: GrassParams; open?: boolean } =
		$props()

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
			cỏ.
		</p>
		<p class="mt-2 text-xs leading-5 text-slate-500">
			Kéo để xoay · chuột phải để di chuyển · cuộn để zoom. Port từ SimonDev, Quick Grass.
		</p>
	{/snippet}

	{#each groups as group, i (group.title)}
		<ControlGroup title={group.title} open={i === 0}>
			{#each group.controls as c (c.key)}
				<RangeControl {...c} bind:value={params[c.key]} />
			{/each}
		</ControlGroup>
	{/each}
</InspectorPanel>
