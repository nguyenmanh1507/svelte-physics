<script lang="ts">
	import type { Attachment } from 'svelte/attachments'

	import {
		FlightConfigPanel,
		FlightHelp,
		FlightHud,
		FlightTouchControls,
		type AircraftConfig,
		type AircraftKey,
	} from '#lib/components/arcade-flight/index.js'
	import FullscreenStage from '#lib/components/fullscreen-stage.svelte'

	import {
		AIRCRAFT,
		createFlightApp,
		type FlightApp,
		type FlightAppHud,
	} from './components/flight-app'
	import FlightMinimap from './components/flight-minimap.svelte'

	// trang chỉ chạy phía client (ssr = false) nên đọc được matchMedia ngay
	const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
	const narrow = matchMedia('(max-width: 640px)').matches

	let app = $state.raw<FlightApp | null>(null)
	let hud = $state.raw<FlightAppHud | null>(null)
	let aircraft = $state<AircraftKey>('fighter')
	let config = $state.raw<AircraftConfig | null>(null)
	let panel = $state<'help' | 'cfg' | null>(null)
	let started = $state(false)
	let showMap = $state(true)
	let failure = $state('')

	const mountApp: Attachment<HTMLElement> = (host) => {
		let cancelled = false
		let created: FlightApp | null = null
		createFlightApp(host, { touch, onHud: (h) => (hud = h) })
			.then((a) => {
				// component có thể bị huỷ (chuyển trang, HMR) khi model còn đang nạp
				if (cancelled) return a.dispose()
				created = a
				app = a
				config = a.config
			})
			.catch((error: unknown) => {
				if (cancelled) return
				const message = error instanceof Error ? error.message : String(error)
				failure = /webgl/i.test(message)
					? 'Trình duyệt này chưa hỗ trợ WebGL nên không dựng được khung cảnh.'
					: `Lỗi: ${message}`
				console.error(error)
			})
		return () => {
			cancelled = true
			created?.dispose()
			app = null
		}
	}

	function start() {
		if (!app) return
		started = true
		app.start()
	}

	function selectAircraft(key: AircraftKey) {
		if (!app) return
		app.setAircraft(key)
		aircraft = key
		config = app.config
	}

	function applyConfig(c: AircraftConfig) {
		if (!app) return
		app.applyConfig(c)
		config = app.config
	}

	const togglePanel = (p: 'help' | 'cfg') => (panel = panel === p ? null : p)

	// phím của trang (phím bay do FlightInput xử lý)
	function onKeydown(e: KeyboardEvent) {
		const t = e.target as HTMLElement | null
		if (t?.tagName === 'TEXTAREA' || t?.tagName === 'INPUT') return
		if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
		const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code)
		if (i >= 0) selectAircraft(AIRCRAFT[i].key)
		else if (e.code === 'KeyH') togglePanel('help')
		else if (e.code === 'KeyP') togglePanel('cfg')
		else if (e.code === 'KeyN') showMap = !showMap
	}
</script>

<svelte:window onkeydown={onKeydown} />

<FullscreenStage label="Arcade flight — Su-57">
	<div class="stage">
		<!-- canvas WebGL + reticle được gắn vào đây, nằm dưới HUD -->
		<div class="viewport" {@attach mountApp}></div>
		{#if failure}
			<p class="failure">{failure}</p>
		{:else}
			<FlightHud {hud} showChips={!touch}>
				{#if hud}
					<div class="row rings">
						<span class="lbl">VÒNG</span><span>{hud.rings}/{hud.ringCount}</span>
					</div>
				{/if}
			</FlightHud>

			<div class="top-right">
				{#each AIRCRAFT as a, i (a.key)}
					<button
						type="button"
						class:on={aircraft === a.key}
						disabled={!app}
						onclick={() => selectAircraft(a.key)}
						aria-keyshortcuts={String(i + 1)}>{i + 1} · {a.label}</button
					>
				{/each}
				<button
					type="button"
					disabled={!app}
					onclick={() => app?.flight.cycleMode()}
					aria-keyshortcuts="M">M · {hud?.modeName ?? 'Chế độ'}</button
				>
				<button
					type="button"
					class:on={showMap}
					onclick={() => (showMap = !showMap)}
					aria-pressed={showMap}
					aria-keyshortcuts="N">N · Bản đồ</button
				>
				<button
					type="button"
					class:on={panel === 'help'}
					onclick={() => togglePanel('help')}
					aria-expanded={panel === 'help'}
					aria-keyshortcuts="H">H · Phím</button
				>
				<button
					type="button"
					class:on={panel === 'cfg'}
					disabled={!config}
					onclick={() => togglePanel('cfg')}
					aria-expanded={panel === 'cfg'}
					aria-keyshortcuts="P">P · Config</button
				>
			</div>

			<!-- bảng bên phải che chỗ của mini map nên ẩn tạm khi đang mở -->
			{#if showMap && app && !panel}
				<div class="minimap-slot">
					<FlightMinimap source={app.minimap} size={narrow ? 128 : 200} />
				</div>
			{/if}

			{#if panel === 'help'}
				<aside class="side" aria-label="Bảng phím">
					<FlightHelp>
						{#snippet extra()}
							<tr>
								<td><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd></td>
								<td>
									Chọn máy bay · <kbd>N</kbd> mini map · <kbd>H</kbd> bảng phím · <kbd>P</kbd> config
								</td>
							</tr>
						{/snippet}
					</FlightHelp>
				</aside>
			{:else if panel === 'cfg' && app && config}
				<aside class="side" aria-label="Config máy bay">
					<FlightConfigPanel {config} defaults={app.defaultConfig} onapply={applyConfig} />
				</aside>
			{/if}

			{#if touch && app && started}
				<FlightTouchControls
					input={app.flight.input}
					onmode={() => app?.flight.cycleMode()}
					onreset={() => app?.flight.respawn()}
				/>
			{/if}

			{#if !started}
				<div class="start">
					<div class="start-card">
						<h1>Arcade Plane Controller · Su-57</h1>
						<p>
							Lõi bay engine-agnostic: rate-command + G-limit + AoA-limit, 3 chế độ điều khiển
							(Mouse-aim / Standard / Expert), 3 config máy bay và hệ thống maneuver dạng state
							machine (Cobra, Kulbit, Herbst, Split-S, Immelmann, High-G, Barrel roll).
						</p>
						<p>
							Bay qua các vòng xanh để luyện tập. Bấm <kbd>H</kbd> xem phím, <kbd>P</kbd> chỉnh config
							trực tiếp.
						</p>
						{#if touch}
							<p>
								Trên màn hình cảm ứng: cần ảo bên trái, nút maneuver bên phải (chế độ Standard).
							</p>
						{/if}
						<button type="button" class="go" disabled={!app} onclick={start}>
							{app ? 'Bắt đầu bay' : 'Đang nạp model…'}
						</button>
					</div>
				</div>
			{/if}
		{/if}
	</div>
</FullscreenStage>

<style>
	.stage {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background: #0b1520;
		color: #e8f3ee;
		font-family: system-ui, sans-serif;
	}
	.viewport {
		position: absolute;
		inset: 0;
	}
	.failure {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		margin: 0;
		padding: 24px;
		text-align: center;
	}
	.rings {
		margin-top: 6px;
	}
	.top-right {
		position: absolute;
		right: 14px;
		top: 14px;
		z-index: 5;
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 6px;
		max-width: 60%;
	}
	button {
		font-size: 12.5px;
		color: #e8f3ee;
		background: rgb(8 16 22 / 0.62);
		border: 1px solid rgb(125 255 176 / 0.25);
		border-radius: 6px;
		padding: 6px 10px;
		cursor: pointer;
		backdrop-filter: blur(4px);
	}
	button:hover:not(:disabled),
	button:focus-visible {
		border-color: #7dffb0;
	}
	button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	button.on {
		background: rgb(125 255 176 / 0.18);
		border-color: #7dffb0;
		color: #fff;
	}
	.minimap-slot {
		position: absolute;
		right: 14px;
		top: 56px;
		z-index: 4;
		pointer-events: none;
	}
	.side {
		position: absolute;
		right: 14px;
		top: 56px;
		bottom: 14px;
		z-index: 6;
		width: min(430px, calc(100% - 28px));
		overflow: auto;
		padding: 14px 16px;
		background: rgb(8 16 22 / 0.88);
		border: 1px solid rgb(125 255 176 / 0.25);
		border-radius: 10px;
		backdrop-filter: blur(6px);
	}
	.side kbd,
	.start-card kbd {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		background: rgb(255 255 255 / 0.1);
		border-radius: 3px;
		padding: 0 4px;
	}
	.start {
		position: absolute;
		inset: 0;
		z-index: 10;
		display: flex;
		align-items: center;
		justify-content: center;
		background: radial-gradient(ellipse at center, rgb(5 12 18 / 0.55), rgb(5 12 18 / 0.9));
	}
	.start-card {
		max-width: 560px;
		margin: 16px;
		padding: 22px 24px;
		background: rgb(8 16 22 / 0.92);
		border: 1px solid rgb(125 255 176 / 0.25);
		border-radius: 12px;
	}
	.start-card h1 {
		margin: 0 0 6px;
		font-size: 22px;
		font-weight: 700;
	}
	.start-card p {
		margin: 6px 0;
		color: #b9cbc4;
		font-size: 14px;
		line-height: 1.55;
	}
	.go {
		margin-top: 12px;
		font-size: 15px;
		padding: 10px 18px;
		background: rgb(125 255 176 / 0.2);
		border-color: #7dffb0;
	}
	@media (max-width: 640px) {
		/* cột nút bên phải cao, đặt bản đồ giữa mép trên */
		.minimap-slot {
			right: auto;
			left: 50%;
			top: 8px;
			transform: translateX(-50%);
		}
		.top-right {
			right: 8px;
			top: 8px;
			flex-direction: column;
			align-items: flex-end;
			gap: 4px;
		}
		.top-right button {
			font-size: 11px;
			padding: 4px 7px;
		}
	}
</style>
