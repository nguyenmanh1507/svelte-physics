<script lang="ts">
	import { focusRing } from './focus'

	let {
		label,
		options,
		value = $bindable(),
	}: { label: string; options: { label: string; value: number }[]; value: number } = $props()
</script>

<label class="flex items-center justify-between gap-3 text-sm">
	<span class="font-medium text-slate-300">{label}</span>
	<select
		class="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-cyan-300 {focusRing}"
		bind:value
	>
		{#each options as o (o.value)}
			<option value={o.value}>{o.label}</option>
		{/each}
	</select>
</label>
