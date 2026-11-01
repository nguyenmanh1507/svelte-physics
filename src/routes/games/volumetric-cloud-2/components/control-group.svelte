<script lang="ts">
	import type { Snippet } from 'svelte'
	import { focusRing } from './focus'

	let {
		title,
		hint,
		open = false,
		children,
	}: { title: string; hint?: string; open?: boolean; children: Snippet } = $props()
</script>

<details {open} class="rounded-lg border border-slate-800 bg-slate-900/40">
	<summary
		class="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-200 select-none {focusRing}"
	>
		{title}
	</summary>
	<div class="grid gap-3 border-t border-slate-800 px-3 py-3">
		{@render children()}
		{#if hint}
			<p class="text-xs leading-5 text-slate-500">{hint}</p>
		{/if}
	</div>
</details>
