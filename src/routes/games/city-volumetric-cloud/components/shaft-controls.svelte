<script lang="ts">
	import {
		defaultLightShaftParams,
		type LightShaftParams,
	} from '#lib/components/nubis-cloud/index.js'
	import ParamSlider from './param-slider.svelte'
	import { SHAFT_CONTROLS } from './sky-config'

	let { params = $bindable(), disabled = false }: { params: LightShaftParams; disabled?: boolean } =
		$props()

	const focus =
		'focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none'
</script>

<fieldset {disabled} class="px-4 pb-4 disabled:opacity-40">
	<legend class="sr-only">Tia nắng xuyên mây</legend>
	<details class="rounded-lg border border-slate-800 bg-slate-900/40">
		<summary
			class="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-200 select-none {focus}"
		>
			Tia nắng
		</summary>
		<div class="grid gap-3 border-t border-slate-800 px-3 py-3">
			<label class="flex items-center gap-2 text-xs font-medium text-slate-300">
				<input type="checkbox" class="accent-cyan-400 {focus}" bind:checked={params.enabled} />
				Tia nắng xuyên qua khe mây
			</label>
			{#each SHAFT_CONTROLS as c (c.key)}
				<ParamSlider {...c} bind:value={params[c.key]} />
			{/each}
			<button
				type="button"
				class="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800 {focus}"
				onclick={() => (params = { ...defaultLightShaftParams })}
			>
				Đặt lại tia nắng
			</button>
		</div>
	</details>
</fieldset>
