<script lang="ts">
	let {
		label,
		min,
		max,
		step,
		value = $bindable(),
	}: { label: string; min: number; max: number; step: number; value: number } = $props()

	// hiện đúng số chữ số thập phân của step (fogDensity 0.000008 thay vì 0.000008000001)
	const format = (v: number) => v.toFixed((String(step).split('.')[1] ?? '').length)
</script>

<label class="grid gap-1.5">
	<span class="flex items-center justify-between gap-3 text-xs">
		<span class="font-medium text-slate-300">{label}</span>
		<output
			class="min-w-14 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-right font-mono text-xs leading-none font-semibold text-cyan-300 tabular-nums"
		>
			{format(value)}
		</output>
	</span>
	<input
		class="h-5 w-full cursor-pointer accent-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none"
		type="range"
		{min}
		{max}
		{step}
		bind:value
	/>
</label>
