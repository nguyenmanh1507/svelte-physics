<script lang="ts">
	import { onMount } from 'svelte'

	import type { PondSettings, PondStats } from './world/create-pond-scene'

	type Props = {
		settings: PondSettings
		stats: PondStats | null
		onfeed: () => void
		onstone: () => void
	}

	let { settings = $bindable(), stats, onfeed, onstone }: Props = $props()

	let folded = $state(false)
	const clarityLabel = $derived(
		settings.clarity > 0.7 ? 'trong' : settings.clarity > 0.4 ? 'hơi đục' : 'đục'
	)

	onMount(() => {
		folded = innerWidth < 560
	})
</script>

<aside class="panel" aria-label="Bảng điều khiển ao sen">
	<div class="head">
		<h1>Ao <span>Sen</span> Nhỏ</h1>
		<button
			type="button"
			class="collapse"
			aria-label={folded ? 'Mở bảng điều khiển' : 'Thu gọn bảng điều khiển'}
			aria-expanded={!folded}
			onclick={() => (folded = !folded)}
		>
			{folded ? '+' : '–'}
		</button>
	</div>

	{#if !folded}
		<p class="eq">
			Ao sâu nhất 0.55 m. Mặt nước giải phương trình sóng với tốc độ đổi theo độ sâu,
			<code>c = √(g·d)</code> (Bridson §12.2), nên gợn sóng chậm lại khi tới gần bờ. Cá koi bơi bằng
			steering behaviors của Buckland (ch.3): <code>wander</code>, <code>separation</code>,
			<code>arrive</code>, <code>flee</code>.
		</p>

		<div class="row">
			<button type="button" class="btn primary" onclick={onfeed}>Rắc thức ăn</button>
			<button type="button" class="btn" onclick={onstone}>Ném sỏi</button>
		</div>

		<div class="toggles">
			<label class="sw">
				Gió nhẹ
				<input type="checkbox" bind:checked={settings.wind} />
				<i></i>
			</label>
			<label class="sw">
				Nắng xuyên nước (caustics)
				<input type="checkbox" bind:checked={settings.caustics} />
				<i></i>
			</label>
		</div>

		<div class="slider">
			<label for="pond-clarity">Độ trong của nước <b>{clarityLabel}</b></label>
			<input
				id="pond-clarity"
				type="range"
				min="0"
				max="1"
				step="0.01"
				bind:value={settings.clarity}
			/>
		</div>

		<div class="read" aria-live="off">
			{#if stats}
				gợn sóng giữa ao <b>{stats.speedMid.toFixed(2)} m/s</b> → sát bờ
				<b>{stats.speedEdge.toFixed(2)} m/s</b><br />
				d hiệu dụng = {stats.depthScale}·độ sâu · lưới {stats.grid}×{stats.grid} · {stats.substeps}
				bước/khung<br />
				cá koi <b>{stats.koi}</b> · viên thức ăn <b>{stats.food}</b>
			{:else}
				…
			{/if}
		</div>

		<p class="hint">
			Chạm vào mặt nước để rắc thức ăn, kéo trên mặt nước để khuấy gợn sóng. Kéo trên bờ hoặc chuột
			phải để xoay, cuộn hoặc chụm để zoom.
		</p>
	{/if}
</aside>

<style>
	.panel {
		position: absolute;
		top: 12px;
		left: 12px;
		width: min(320px, calc(100% - 24px));
		box-sizing: border-box;
		padding: 14px 16px;
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 14px;
		backdrop-filter: blur(14px) saturate(1.2);
		display: flex;
		flex-direction: column;
		gap: 12px;
		max-height: calc(100% - 24px);
		overflow: auto;
	}

	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
	}

	h1 {
		margin: 0;
		font-size: 22px;
		font-weight: 700;
		letter-spacing: -0.01em;
		line-height: 1.1;
	}

	h1 span {
		color: var(--lotus);
	}

	.eq {
		margin: 0;
		font-size: 12.5px;
		line-height: 1.5;
		color: var(--muted);
	}

	.eq code {
		font-family: var(--font-m);
		font-size: 11.5px;
		color: var(--ink);
		white-space: nowrap;
	}

	.collapse {
		flex: none;
		width: 28px;
		height: 28px;
		border-radius: 8px;
		border: 1px solid var(--line);
		background: transparent;
		color: var(--ink);
		font: 500 16px/1 var(--font-m);
		cursor: pointer;
	}

	.row {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.btn {
		flex: 1 1 auto;
		min-height: 36px;
		border-radius: 9px;
		border: 1px solid var(--line);
		background: rgba(143, 209, 138, 0.08);
		color: var(--ink);
		font: 600 14px var(--font-d);
		cursor: pointer;
		padding: 0 12px;
	}

	.btn.primary {
		background: var(--lotus);
		color: #3a0716;
		border-color: transparent;
	}

	.btn:hover {
		filter: brightness(1.1);
	}

	.btn:focus-visible,
	.collapse:focus-visible,
	.sw input:focus-visible + i,
	input[type='range']:focus-visible {
		outline: 2px solid var(--leaf);
		outline-offset: 2px;
	}

	.toggles {
		display: grid;
		gap: 8px;
	}

	.sw {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		font-size: 14px;
		cursor: pointer;
	}

	.sw input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.sw i {
		flex: none;
		width: 34px;
		height: 20px;
		border-radius: 20px;
		background: rgba(255, 255, 255, 0.14);
		position: relative;
		transition: background 0.2s;
	}

	.sw i::after {
		content: '';
		position: absolute;
		top: 3px;
		left: 3px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--ink);
		transition: transform 0.2s;
	}

	.sw input:checked + i {
		background: var(--leaf);
	}

	.sw input:checked + i::after {
		transform: translateX(14px);
		background: #fff;
	}

	.slider {
		display: grid;
		gap: 5px;
	}

	.slider label {
		display: flex;
		justify-content: space-between;
		font-size: 14px;
	}

	.slider label b {
		font: 500 12px var(--font-m);
		color: var(--leaf);
		font-variant-numeric: tabular-nums;
	}

	input[type='range'] {
		width: 100%;
		accent-color: var(--lotus);
		margin: 0;
	}

	.read {
		font: 400 11.5px/1.65 var(--font-m);
		color: var(--muted);
		border-top: 1px solid var(--line);
		padding-top: 10px;
		font-variant-numeric: tabular-nums;
	}

	.read b {
		color: var(--ink);
		font-weight: 500;
	}

	.hint {
		font-size: 12px;
		line-height: 1.5;
		color: var(--muted);
		margin: 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.sw i,
		.sw i::after {
			transition: none;
		}
	}
</style>
