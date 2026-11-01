<script lang="ts">
	import ControlPanel from './components/control-panel.svelte'
	import IsleCanvas from './components/isle-canvas.svelte'
	import type { IsleSettings } from './components/world/create-isle-scene'

	let settings = $state<IsleSettings>({ amp: 1, windDeg: 220, clarity: 0.7, toonStyle: true })
	let chipHidden = $state(false)
	let canvas = $state<IsleCanvas>()
</script>

<svelte:head>
	<title>Lighthouse Isle</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		rel="stylesheet"
		href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;800&family=Be+Vietnam+Pro:wght@400;500;600&display=swap"
	/>
</svelte:head>

<!-- 6rem = header 4rem + padding dọc của main -->
<section
	aria-label="Lighthouse Isle"
	class="isle relative h-[calc(100dvh-6rem)] min-h-96 overflow-hidden rounded-xl bg-slate-950"
>
	<IsleCanvas bind:this={canvas} {settings} onwatertap={() => (chipHidden = true)} />
	<ControlPanel bind:settings onbigwave={() => canvas?.sendBigWave()} />
	<div class={['chip', { 'hidden-chip': chipHidden }]}>Chạm mặt nước để tạo gợn sóng</div>
</section>

<style>
	.isle {
		--paper: #fff7e6;
		--paper-2: #f6e7c8;
		--ink: #17324d;
		--ink-dim: #4f6478;
		--sea: #1fb5c9;
		--coral: #ef5b4c;
		--f-display: 'Baloo 2', 'Be Vietnam Pro', system-ui, sans-serif;
		--f-body: 'Be Vietnam Pro', system-ui, -apple-system, 'Segoe UI', sans-serif;
		color: var(--ink);
		font-family: var(--f-body);
	}

	.chip {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		bottom: 14px;
		padding: 6px 13px;
		border-radius: 999px;
		background: var(--paper);
		border: 2px solid var(--ink);
		font-size: 12px;
		font-weight: 500;
		white-space: nowrap;
		pointer-events: none;
	}

	.chip.hidden-chip {
		opacity: 0;
	}

	@media (max-width: 560px) {
		.chip {
			font-size: 11px;
		}
	}
</style>
