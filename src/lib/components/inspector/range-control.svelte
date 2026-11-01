<script lang="ts">
	import { focusRing } from './focus'

	let {
		label,
		min,
		max,
		step,
		hint,
		value = $bindable(),
	}: {
		label: string
		min: number
		max: number
		step: number
		hint?: string
		value: number
	} = $props()

	// hiện đúng số chữ số thập phân của step
	const format = (v: number) => v.toFixed((String(step).split('.')[1] ?? '').length)
</script>

<label class="grid gap-2">
	<span class="flex items-center justify-between gap-3 text-sm">
		<span class="font-medium text-slate-300">{label}</span>
		<output
			class="min-w-14 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-right font-mono text-xs leading-none font-semibold text-cyan-300 tabular-nums"
		>
			{format(value)}
		</output>
	</span>
	<input
		class="h-6 w-full cursor-pointer accent-cyan-400 {focusRing}"
		type="range"
		{min}
		{max}
		{step}
		bind:value
	/>
	{#if hint}
		<span class="text-xs text-slate-500">{hint}</span>
	{/if}
</label>
