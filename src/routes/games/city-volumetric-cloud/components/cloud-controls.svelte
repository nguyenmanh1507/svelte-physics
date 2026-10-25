<script lang="ts">
	import { nubisPresets, type NubisParams } from '#lib/components/nubis-cloud/index.js'
	import ParamSlider from './param-slider.svelte'
	import { CLOUD_CONTROLS, DEBUG_VIEWS, RENDER_SCALES, citySky } from './sky-config'

	let { params = $bindable(), disabled = false }: { params: NubisParams; disabled?: boolean } =
		$props()

	const focus =
		'focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none'
	const field = `w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-200 ${focus}`
	const button = `rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800 ${focus}`
</script>

<fieldset {disabled} class="grid gap-3 p-4 disabled:opacity-40">
	<legend class="sr-only">Cấu hình mây</legend>

	<div class="grid grid-cols-2 gap-2">
		{#each Object.entries(nubisPresets) as [name, preset] (name)}
			<button type="button" class={button} onclick={() => Object.assign(params, preset)}>
				{name}
			</button>
		{/each}
	</div>

	{#each CLOUD_CONTROLS as { group, controls }, i (group)}
		<details open={i === 0} class="rounded-lg border border-slate-800 bg-slate-900/40">
			<summary
				class="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-200 select-none {focus}"
			>
				{group}
			</summary>
			<div class="grid gap-3 border-t border-slate-800 px-3 py-3">
				{#each controls as c (c.key)}
					<ParamSlider {...c} bind:value={params[c.key]} />
				{/each}

				{#if group === 'Hậu kỳ'}
					<label class="flex items-center gap-2 text-xs font-medium text-slate-300">
						<input type="checkbox" class="accent-cyan-400 {focus}" bind:checked={params.post} />
						Bật hậu kỳ stylized
					</label>
				{:else if group === 'Hình dạng'}
					<label class="flex items-center gap-2 text-xs font-medium text-slate-300">
						<input type="checkbox" class="accent-cyan-400 {focus}" bind:checked={params.animate} />
						Mây trôi theo gió
					</label>
				{:else if group === 'Hiển thị'}
					<label class="grid gap-1.5 text-xs font-medium text-slate-300">
						Độ phân giải pass mây
						<select class={field} bind:value={params.renderScale}>
							{#each RENDER_SCALES as s (s)}
								<option value={s}>{s * 100}%</option>
							{/each}
						</select>
					</label>
					<label class="grid gap-1.5 text-xs font-medium text-slate-300">
						Debug
						<select class={field} bind:value={params.debugMode}>
							{#each DEBUG_VIEWS as v (v.value)}
								<option value={v.value}>{v.label}</option>
							{/each}
						</select>
					</label>
				{/if}
			</div>
		</details>
	{/each}

	<button type="button" class="{button} w-full py-2.5 text-sm" onclick={() => (params = citySky())}>
		Đặt lại thông số mây
	</button>
</fieldset>
