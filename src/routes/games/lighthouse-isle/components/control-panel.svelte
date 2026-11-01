<script lang="ts">
	import { onMount } from 'svelte'

	import RangeControl from './range-control.svelte'
	import type { IsleSettings } from './world/create-isle-scene'

	type Props = {
		settings: IsleSettings
		onbigwave: () => void
	}

	let { settings = $bindable(), onbigwave }: Props = $props()

	let folded = $state(false)
	const clarityLabel = $derived(
		settings.clarity > 0.66 ? 'trong' : settings.clarity > 0.33 ? 'hơi đục' : 'đục'
	)

	onMount(() => {
		folded = innerWidth < 560
	})
</script>

<aside class={['panel', { folded }]} aria-label="Điều khiển">
	<header>
		<div>
			<h1>Lighthouse <span>Isle</span></h1>
			<div class="tag">Stylized water · WebGL2</div>
		</div>
		<button
			type="button"
			class="fold"
			aria-label="Thu gọn bảng"
			aria-expanded={!folded}
			onclick={() => (folded = !folded)}
		>
			{folded ? '+' : '–'}
		</button>
	</header>

	{#if !folded}
		<p class="lede">
			Một hộp biển 100 × 100. Nước tô màu theo độ sâu thật, nhìn xuyên xuống đáy cát; sóng đánh vào
			đảo và đá thì sủi bọt, bắn tia nước.
		</p>

		<RangeControl
			id="amp"
			label="Độ cao sóng"
			display={settings.amp.toFixed(2)}
			min={0}
			max={2.4}
			step={0.05}
			bind:value={settings.amp}
		/>
		<RangeControl
			id="dir"
			label="Hướng gió"
			display="{settings.windDeg}°"
			min={0}
			max={359}
			step={1}
			bind:value={settings.windDeg}
		/>
		<RangeControl
			id="clr"
			label="Độ trong của nước"
			display={clarityLabel}
			min={0}
			max={1}
			step={0.01}
			bind:value={settings.clarity}
		/>

		<div class="seg" role="group" aria-label="Kiểu tô">
			<button
				type="button"
				class={{ on: settings.toonStyle }}
				aria-pressed={settings.toonStyle}
				onclick={() => (settings.toonStyle = true)}>Toon</button
			>
			<button
				type="button"
				class={{ on: !settings.toonStyle }}
				aria-pressed={!settings.toonStyle}
				onclick={() => (settings.toonStyle = false)}>Mượt</button
			>
		</div>
		<button type="button" class="big" onclick={onbigwave}>Đợt sóng lớn!</button>
		<p class="hint">Kéo để xoay hộp, cuộn để phóng to. Chạm vào mặt nước để thả một hòn sỏi.</p>
	{/if}
</aside>

<style>
	.panel {
		position: absolute;
		top: 14px;
		left: 14px;
		width: 270px;
		max-width: calc(100% - 28px);
		max-height: calc(100% - 28px);
		overflow-y: auto;
		box-sizing: border-box;
		padding: 14px 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		background: var(--paper);
		border: 2.5px solid var(--ink);
		border-radius: 18px;
		box-shadow: 5px 6px 0 var(--ink);
		font-size: 13px;
		line-height: 1.5;
	}

	.panel.folded {
		width: auto;
	}

	.panel header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 8px;
	}

	h1 {
		margin: 0;
		font-family: var(--f-display);
		font-weight: 800;
		font-size: 27px;
		line-height: 1;
		letter-spacing: -0.01em;
	}

	h1 span {
		color: var(--coral);
	}

	.tag {
		display: inline-block;
		margin-top: 6px;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--sea);
	}

	.lede {
		margin: 0;
		color: var(--ink-dim);
	}

	.fold {
		flex: none;
		width: 30px;
		height: 30px;
		border-radius: 10px;
		border: 2px solid var(--ink);
		background: var(--paper-2);
		color: var(--ink);
		font: 700 16px/1 var(--f-display);
		cursor: pointer;
	}

	.seg {
		display: grid;
		grid-template-columns: 1fr 1fr;
		border: 2px solid var(--ink);
		border-radius: 11px;
		overflow: hidden;
	}

	.seg button {
		border: 0;
		background: var(--paper);
		color: var(--ink);
		padding: 6px 4px;
		font: 600 12.5px var(--f-body);
		cursor: pointer;
	}

	.seg button + button {
		border-left: 2px solid var(--ink);
	}

	.seg button.on {
		background: var(--sea);
		color: #fff;
	}

	.big {
		border: 2.5px solid var(--ink);
		border-radius: 12px;
		background: var(--coral);
		color: #fff;
		font: 800 16px/1 var(--f-display);
		padding: 10px 8px 8px;
		cursor: pointer;
		box-shadow: 3px 3px 0 var(--ink);
		transition:
			transform 0.08s,
			box-shadow 0.08s;
	}

	.big:active {
		transform: translate(2px, 2px);
		box-shadow: 1px 1px 0 var(--ink);
	}

	.panel button:focus-visible {
		outline: 3px solid var(--sea);
		outline-offset: 2px;
	}

	.hint {
		margin: 0;
		font-size: 11.5px;
		color: var(--ink-dim);
	}

	@media (max-width: 560px) {
		.panel {
			width: calc(100% - 28px);
			max-height: 52%;
		}
	}
</style>
