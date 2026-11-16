<!--
	HUD cho ArcadeFlightController: bảng số liệu, banner maneuver, thông báo, cảnh báo,
	chip maneuver và log combo. Đặt trong một khung position: relative/absolute/fixed.
	`children` chèn thêm dòng vào bảng số liệu (vd. số vòng đã qua).
-->
<script lang="ts">
	import type { Snippet } from 'svelte'

	import type { FlightHudData } from './three/arcade-flight-controller'

	let {
		hud,
		showChips = true,
		children,
	}: { hud: FlightHudData | null; showChips?: boolean; children?: Snippet } = $props()
</script>

{#if hud}
	<div class="hud panel flight-stats">
		<div class="title">{hud.aircraftName}</div>
		<div class="mode">{hud.modeName}</div>
		<div class="row first">
			<span class="lbl">SPD</span><span class="big">{hud.speedKmh} km/h</span>
		</div>
		<div class="row"><span class="lbl">ALT</span><span class="big">{hud.altitude} m</span></div>
		<div class="row">
			<span class="lbl">AoA</span><span class={hud.aoaLevel}>{hud.aoaDeg.toFixed(1)}°</span>
		</div>
		<div class="row">
			<span class="lbl">G</span><span class:warn={hud.gWarn}>{hud.gLoad.toFixed(1)}</span>
		</div>
		<div class="row">
			<span class="lbl">THR</span>
			<span>{Math.round(hud.throttle * 100)}%{hud.afterburner > 0.1 ? ' AB' : ''}</span>
		</div>
		<div class="bar" aria-hidden="true">
			<i style:width="{hud.throttle * 100}%"></i>
			<b style:width="{hud.afterburner * 100}%"></b>
			<u style:left="{hud.throttleSetting * 100}%"></u>
		</div>
		{@render children?.()}
	</div>

	<div class="hud banner">
		<div class="man">{hud.maneuver}</div>
		<div class="sub">{hud.maneuverSub}</div>
	</div>

	{#if hud.message}
		<div class="hud msg {hud.message.kind}" role="status">{hud.message.text}</div>
	{/if}
	<div class="hud warning" role="alert">{hud.warning}</div>
	{#if hud.crashed}
		<div class="hud crash">CRASHED<small>Hồi sinh sau giây lát… (R)</small></div>
	{/if}

	{#if showChips}
		<div class="hud panel bottom">
			<div class="chips">
				{#each hud.chips as chip (chip.id)}
					<span
						class="chip"
						class:off={!chip.available}
						class:cd={chip.available && chip.cooldown > 0}
					>
						{chip.name} <span class="keys">{chip.keys}</span>
						{#if chip.available && chip.cooldown > 0}{chip.cooldown.toFixed(1)}s{/if}
					</span>
				{/each}
			</div>
			<div class="log">
				Input: {#if hud.lastEvent}<b>{hud.lastEvent}</b>{:else}—{/if}
				{#each hud.combos as c, i (i)}
					· <b>{c.kind}</b> {c.name} {c.gapMs}ms
				{/each}
			</div>
		</div>
	{/if}
{/if}

<style>
	.hud {
		--hud: #7dffb0;
		--hud-dim: rgb(125 255 176 / 0.55);
		--warn: #ffcf4a;
		--bad: #ff5b5b;
		--line: rgb(125 255 176 / 0.25);
		position: absolute;
		font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
		color: var(--hud);
		text-shadow: 0 0 6px rgb(0 0 0 / 0.8);
		pointer-events: none;
		font-variant-numeric: tabular-nums;
	}
	.panel {
		background: rgb(8 16 22 / 0.62);
		border: 1px solid var(--line);
		border-radius: 8px;
		backdrop-filter: blur(4px);
	}
	.flight-stats {
		left: 16px;
		top: 14px;
		padding: 10px 14px;
		min-width: 210px;
	}
	.flight-stats .title {
		font-family: system-ui, sans-serif;
		font-weight: 700;
		font-size: 13px;
		color: #fff;
		margin-bottom: 4px;
		letter-spacing: 0.02em;
	}
	.flight-stats .mode {
		display: inline-block;
		margin-top: 2px;
		padding: 1px 7px;
		border: 1px solid var(--hud);
		border-radius: 4px;
		font-size: 12px;
	}
	.flight-stats :global(.row) {
		display: flex;
		justify-content: space-between;
		gap: 18px;
		font-size: 14px;
	}
	.flight-stats .row.first {
		margin-top: 8px;
	}
	.flight-stats :global(.lbl) {
		color: var(--hud-dim);
	}
	.big {
		font-size: 26px;
		line-height: 1.1;
	}
	.warn {
		color: var(--warn);
	}
	.bad {
		color: var(--bad);
	}
	.bar {
		height: 8px;
		background: rgb(255 255 255 / 0.08);
		border-radius: 4px;
		overflow: hidden;
		margin-top: 4px;
		position: relative;
	}
	.bar > * {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
	}
	.bar > i {
		background: var(--hud);
	}
	.bar > b {
		background: linear-gradient(90deg, #ff9d2e, #ff3d1f);
	}
	.bar > u {
		top: -2px;
		bottom: -2px;
		width: 2px;
		background: #fff;
	}
	.banner {
		left: 50%;
		top: 16%;
		transform: translateX(-50%);
		text-align: center;
	}
	.banner .man {
		font-size: 30px;
		letter-spacing: 0.12em;
		color: #fff;
		text-shadow: 0 0 14px rgb(125 255 176 / 0.9);
	}
	.banner .sub {
		font-size: 13px;
		color: var(--hud-dim);
		margin-top: 2px;
	}
	.msg {
		left: 50%;
		top: 26%;
		transform: translateX(-50%);
		font-size: 15px;
		padding: 4px 12px;
		border-radius: 6px;
		background: rgb(0 0 0 / 0.35);
		white-space: nowrap;
	}
	.msg.warn {
		color: var(--warn);
	}
	.msg.ok {
		color: var(--hud);
	}
	.msg.info {
		color: #fff;
	}
	.warning {
		left: 50%;
		top: 62%;
		transform: translateX(-50%);
		font-size: 24px;
		color: var(--bad);
		letter-spacing: 0.15em;
	}
	.crash {
		left: 50%;
		top: 40%;
		transform: translate(-50%, -50%);
		font-size: 34px;
		color: var(--bad);
		letter-spacing: 0.2em;
		text-align: center;
	}
	.crash small {
		display: block;
		font-size: 14px;
		letter-spacing: 0.05em;
		color: #fff;
		margin-top: 6px;
	}
	.bottom {
		left: 16px;
		bottom: 14px;
		padding: 8px 12px;
		max-width: 440px;
		font-size: 12.5px;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		margin-bottom: 6px;
	}
	.chip {
		border: 1px solid var(--line);
		border-radius: 4px;
		padding: 1px 6px;
	}
	.chip .keys {
		opacity: 0.6;
	}
	.chip.cd {
		color: var(--warn);
		border-color: rgb(255 207 74 / 0.35);
	}
	.chip.off {
		color: #6b7a76;
		border-color: rgb(255 255 255 / 0.1);
		text-decoration: line-through;
	}
	.log {
		color: var(--hud-dim);
		min-height: 1.2em;
	}
	.log b {
		color: #fff;
		font-weight: normal;
	}
	@media (max-width: 640px) {
		.flight-stats {
			left: 8px;
			top: 8px;
			transform: scale(0.72);
			transform-origin: top left;
		}
		.banner .man {
			font-size: 20px;
		}
		.msg {
			font-size: 12px;
			white-space: normal;
			width: 86vw;
			text-align: center;
		}
	}
	@media (pointer: coarse) {
		.bottom {
			display: none;
		}
	}
</style>
