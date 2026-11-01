<script lang="ts">
	import { focusRing } from './focus'

	let {
		label,
		note,
		checked = $bindable(),
	}: { label: string; note?: string; checked: boolean } = $props()
</script>

<label class="flex items-center gap-2.5 text-sm font-medium text-slate-300">
	<input type="checkbox" class="size-4 accent-cyan-400 {focusRing}" bind:checked />
	<span>
		{label}
		{#if note}
			<small class="text-xs font-normal text-slate-500">{note}</small>
		{/if}
	</span>
</label>
