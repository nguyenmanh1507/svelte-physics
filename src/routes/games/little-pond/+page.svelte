<script lang="ts">
	import ControlPanel from './components/control-panel.svelte'
	import PondCanvas from './components/pond-canvas.svelte'
	import type { PondSettings, PondStats } from './components/world/create-pond-scene'

	let settings = $state<PondSettings>({ wind: true, caustics: true, clarity: 0.8 })
	let stats = $state<PondStats | null>(null)
	let canvas = $state<PondCanvas>()
</script>

<svelte:head>
	<title>Ao Sen Nhỏ</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		rel="stylesheet"
		href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=IBM+Plex+Mono:wght@400;500&display=swap"
	/>
</svelte:head>

<!-- 6rem = header 4rem + padding dọc của main -->
<section
	aria-label="Ao sen nhỏ"
	class="pond relative h-[calc(100dvh-6rem)] min-h-96 overflow-hidden rounded-xl"
>
	<PondCanvas bind:this={canvas} {settings} onstats={(s) => (stats = s)} />
	<ControlPanel
		bind:settings
		{stats}
		onfeed={() => canvas?.feed()}
		onstone={() => canvas?.throwStone()}
	/>
</section>

<style>
	.pond {
		--deep: #0d1a14;
		--panel: rgba(12, 30, 22, 0.66);
		--line: rgba(190, 230, 200, 0.2);
		--ink: #f1f6ef;
		--muted: #a9c2ae;
		--leaf: #8fd18a;
		--lotus: #f28fb0;
		--font-d: 'Bricolage Grotesque', 'Avenir Next', 'Segoe UI', system-ui, sans-serif;
		--font-m: 'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace;
		color-scheme: dark;
		background: var(--deep);
		color: var(--ink);
		font-family: var(--font-d);
	}
</style>
