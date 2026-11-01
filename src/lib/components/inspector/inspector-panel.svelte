<script lang="ts">
	import type { Snippet } from 'svelte'
	import { focusRing } from './focus'

	// Bảng điều khiển nổi bên phải, đặt trong một khung `relative` (vd. FullscreenStage).
	let {
		id,
		eyebrow,
		title,
		description,
		children,
		onreset,
		open = $bindable(true),
	}: {
		id: string
		eyebrow: string
		title: string
		description?: Snippet // phần mô tả dưới tiêu đề
		children: Snippet // các ControlGroup
		onreset?: () => void // có thì hiện nút "Đặt lại thông số"
		open?: boolean
	} = $props()
</script>

{#if !open}
	<button
		type="button"
		aria-controls={id}
		aria-expanded="false"
		class="absolute top-3 right-3 rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm font-semibold text-slate-100 shadow-xl backdrop-blur hover:bg-slate-900 {focusRing}"
		onclick={() => (open = true)}
	>
		Bảng điều khiển
	</button>
{/if}

<aside
	{id}
	aria-label="Điều khiển mô phỏng"
	hidden={!open}
	class="absolute top-0 right-0 bottom-0 w-80 max-w-[85vw] overflow-y-auto border-l border-slate-800 bg-slate-950/85 text-slate-100 shadow-2xl backdrop-blur"
>
	<header class="relative border-b border-slate-800 px-4 py-4">
		<button
			type="button"
			aria-controls={id}
			aria-expanded="true"
			aria-label="Ẩn bảng điều khiển"
			class="absolute top-3 right-3 grid size-8 place-items-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-100 {focusRing}"
			onclick={() => (open = false)}
		>
			✕
		</button>
		<p class="font-mono text-xs font-medium tracking-[0.18em] text-cyan-400 uppercase">
			{eyebrow}
		</p>
		<h1 class="mt-1 text-lg font-semibold tracking-tight">{title}</h1>
		{@render description?.()}
	</header>

	<div class="grid gap-3 p-4">
		{@render children()}

		{#if onreset}
			<button
				type="button"
				class="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800 {focusRing}"
				onclick={onreset}
			>
				Đặt lại thông số
			</button>
		{/if}
	</div>
</aside>
