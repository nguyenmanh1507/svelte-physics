<script lang="ts">
	import {
		ControlGroup,
		InspectorPanel,
		RangeControl,
		SelectControl,
		ToggleControl,
	} from '#lib/components/inspector/index.js'
	import { defaultCloudParams, type CloudParams } from '#lib/components/volumetric-cloud-2/index.js'
	import {
		LIGHTING_RANGES,
		LIGHTING_TOGGLES,
		RENDER_SCALES,
		WEATHER_RANGES,
		WEATHER_TOGGLES,
	} from './controls'

	let { params = $bindable(), open = $bindable(true) }: { params: CloudParams; open?: boolean } =
		$props()
</script>

<InspectorPanel
	id="cloud-panel"
	eyebrow="Shader inspector"
	title="Volumetric Clouds"
	bind:open
	onreset={() => (params = { ...defaultCloudParams })}
>
	{#snippet description()}
		<p class="mt-1 text-sm leading-5 text-slate-400">
			Mây thể tích theo kỹ thuật Nubis (Horizon Zero Dawn).
		</p>
		<p class="mt-2 text-xs leading-5 text-slate-500">
			Click vào bầu trời rồi: kéo để nhìn · <kbd>W A S D</kbd> bay · <kbd>E</kbd>/<kbd>Q</kbd> lên /
			xuống · <kbd>Shift</kbd> bay nhanh · cuộn để zoom. Tầng mây ở độ cao 1 500 – 4 000 m.
		</p>
	{/snippet}

	<ControlGroup title="Modeling (weather)" open>
		{#each WEATHER_RANGES as c (c.key)}
			<RangeControl {...c} bind:value={params[c.key]} />
		{/each}
		{#each WEATHER_TOGGLES as c (c.key)}
			<ToggleControl {...c} bind:checked={params[c.key]} />
		{/each}
	</ControlGroup>

	<ControlGroup title="Lighting">
		{#each LIGHTING_RANGES as c (c.key)}
			<RangeControl {...c} bind:value={params[c.key]} />
		{/each}
		{#each LIGHTING_TOGGLES as c (c.key)}
			<ToggleControl {...c} bind:checked={params[c.key]} />
		{/each}
	</ControlGroup>

	<ControlGroup title="Hiệu năng">
		<SelectControl
			label="Độ phân giải mây"
			options={RENDER_SCALES}
			bind:value={params.renderScale}
		/>
	</ControlGroup>
</InspectorPanel>
