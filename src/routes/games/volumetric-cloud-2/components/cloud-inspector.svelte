<script lang="ts">
	import { defaultCloudParams, type CloudParams } from '#lib/components/volumetric-cloud-2/index.js'
	import ControlGroup from './control-group.svelte'
	import RangeControl from './range-control.svelte'
	import SelectControl from './select-control.svelte'
	import ToggleControl from './toggle-control.svelte'
	import {
		LIGHTING_RANGES,
		LIGHTING_TOGGLES,
		RENDER_SCALES,
		WEATHER_RANGES,
		WEATHER_TOGGLES,
	} from './controls'
	import { focusRing } from './focus'

	let { params = $bindable(), open = $bindable(true) }: { params: CloudParams; open?: boolean } =
		$props()
</script>

{#if !open}
	<button
		type="button"
		aria-controls="cloud-panel"
		aria-expanded="false"
		class="absolute top-3 right-3 rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm font-semibold text-slate-100 shadow-xl backdrop-blur hover:bg-slate-900 {focusRing}"
		onclick={() => (open = true)}
	>
		Bảng điều khiển
	</button>
{/if}

<aside
	id="cloud-panel"
	aria-label="Điều khiển mô phỏng"
	hidden={!open}
	class="absolute top-0 right-0 bottom-0 w-80 max-w-[85vw] overflow-y-auto border-l border-slate-800 bg-slate-950/85 text-slate-100 shadow-2xl backdrop-blur"
>
	<header class="relative border-b border-slate-800 px-4 py-4">
		<button
			type="button"
			aria-controls="cloud-panel"
			aria-expanded="true"
			aria-label="Ẩn bảng điều khiển"
			class="absolute top-3 right-3 grid size-8 place-items-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-100 {focusRing}"
			onclick={() => (open = false)}
		>
			✕
		</button>
		<p class="font-mono text-xs font-medium tracking-[0.18em] text-cyan-400 uppercase">
			Shader inspector
		</p>
		<h1 class="mt-1 text-lg font-semibold tracking-tight">Volumetric Clouds</h1>
		<p class="mt-1 text-sm leading-5 text-slate-400">
			Mây thể tích theo kỹ thuật Nubis (Horizon Zero Dawn).
		</p>
		<p class="mt-2 text-xs leading-5 text-slate-500">
			Click vào bầu trời rồi: kéo để nhìn · <kbd>W A S D</kbd> bay · <kbd>E</kbd>/<kbd>Q</kbd> lên /
			xuống · <kbd>Shift</kbd> bay nhanh · cuộn để zoom. Tầng mây ở độ cao 1 500 – 4 000 m.
		</p>
	</header>

	<div class="grid gap-3 p-4">
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

		<button
			type="button"
			class="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800 {focusRing}"
			onclick={() => (params = { ...defaultCloudParams })}
		>
			Đặt lại thông số
		</button>
	</div>
</aside>
