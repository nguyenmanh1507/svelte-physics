<script lang="ts">
	import { goto } from '$app/navigation'
	import { resolve } from '$app/paths'
	import { page } from '$app/state'
	import FullscreenStage from '#lib/components/fullscreen-stage.svelte'
	import { createApp, WEBGPU_UNAVAILABLE, type App } from '#lib/components/underwater/game/app.js'
	import type { FpsReading } from '#lib/components/underwater/game/fpsMeter.js'
	import { otherStyle, styleFromUrl, type Style } from '#lib/components/underwater/toon/style.js'

	const STYLE_LABELS: Record<Style, string> = { realistic: 'Chân thực', toon: 'Hoạt hình' }
	// trang chỉ chạy phía client (ssr = false) nên đọc được URL ngay
	const initialStyle = styleFromUrl(location.search)

	let canvas: HTMLCanvasElement
	let guiContainer: HTMLDivElement
	let status = $state('')
	let failure = $state('')
	let fps = $state<FpsReading | null>(null)
	let style = $state(initialStyle)
	// gán khi scene đã nạp xong; cố ý không reactive (effect bên dưới không được chạy lại khi nó đổi)
	let app: App | null = null
	let ready = $state(false)

	function toggleStyle() {
		if (!app) return
		style = otherStyle(style)
		app.setStyle(style)
		// giữ lựa chọn trên URL để link tái hiện đúng thứ đang thấy
		const url = new URL(location.href)
		if (style === 'toon') url.searchParams.set('style', 'toon')
		else url.searchParams.delete('style')
		// shallow: chỉ đổi query string, không nạp lại hay render lại gì
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- đã dùng resolve(), rule không chấp nhận query nối thêm
		void goto(resolve('/games/underwater') + url.search, {
			state: page.state,
			shallow: true,
			replace: true,
		})
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.code === 'KeyT' && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey)
			toggleStyle()
	}

	$effect(() => {
		let cancelled = false
		const debug = new URLSearchParams(location.search).has('debug')
		createApp(canvas, {
			debug,
			style: initialStyle,
			guiContainer,
			onStatus: (text) => (status = text),
			onFps: (reading) => (fps = reading),
		})
			.then((created) => {
				// component có thể bị huỷ (chuyển trang, HMR) khi app còn đang nạp
				if (cancelled) return created.dispose()
				app = created
				ready = true
			})
			.catch((error: unknown) => {
				if (cancelled) return
				const message = error instanceof Error ? error.message : String(error)
				status = ''
				failure =
					message === WEBGPU_UNAVAILABLE
						? 'Trình duyệt này chưa hỗ trợ WebGPU. Hãy thử Chrome, Edge hoặc Safari bản mới.'
						: `Lỗi: ${message}`
				console.error(error)
			})
		return () => {
			cancelled = true
			app?.dispose()
			app = null
			ready = false
		}
	})
</script>

<svelte:window onkeydown={onKeydown} />

<FullscreenStage label="Tàu ngầm dưới biển">
	<div class="stage">
		<canvas bind:this={canvas} class:hidden={failure !== ''}></canvas>

		{#if failure}
			<p class="failure">{failure}</p>
		{:else}
			{#if fps}
				<div class="fps" class:slow={fps.fps < 30} aria-label="Frame rate">
					<strong>{fps.fps.toFixed(0)}</strong> fps
					<span>{fps.frameMs.toFixed(1)} ms</span>
				</div>
			{/if}
			{#if status}
				<p class="status">{status}</p>
			{/if}
			{#if ready}
				<button class="style" type="button" onclick={toggleStyle} aria-keyshortcuts="T">
					Phong cách: <strong>{STYLE_LABELS[style]}</strong> <kbd>T</kbd>
				</button>
			{/if}
			<p class="help">
				W/S tiến lùi · A/D quay · E/Q nổi lặn · kéo chuột để xoay camera · T đổi phong cách
			</p>
		{/if}
		<!-- bảng tinh chỉnh (lil-gui) khi mở với ?debug, đặt dưới widget fps -->
		<div class="gui" bind:this={guiContainer}></div>
	</div>
</FullscreenStage>

<style>
	.stage {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background: #000;
	}
	canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
		touch-action: none;
	}
	canvas.hidden {
		display: none;
	}
	p {
		position: absolute;
		margin: 0;
		font:
			13px/1.4 system-ui,
			sans-serif;
		color: #fff;
		text-shadow: 0 1px 2px rgb(0 0 0 / 0.7);
		pointer-events: none;
	}
	.fps {
		position: absolute;
		top: 12px;
		right: 12px;
		z-index: 1;
		padding: 4px 8px;
		border-radius: 6px;
		background: rgb(0 0 0 / 0.45);
		color: #b8f5c8;
		font:
			12px/1.3 ui-monospace,
			SFMono-Regular,
			Menlo,
			monospace;
		font-variant-numeric: tabular-nums;
		text-align: right;
		pointer-events: none;
	}
	.fps strong {
		font-size: 15px;
	}
	.fps span {
		display: block;
		opacity: 0.75;
	}
	.fps.slow {
		color: #ffb4a8;
	}
	.gui {
		position: absolute;
		top: 56px;
		right: 12px;
		z-index: 1;
	}
	.style {
		position: absolute;
		right: 12px;
		bottom: 12px;
		padding: 7px 12px;
		border: 1px solid rgb(255 255 255 / 0.35);
		border-radius: 8px;
		background: rgb(0 0 0 / 0.45);
		color: #fff;
		font:
			13px/1.4 system-ui,
			sans-serif;
		cursor: pointer;
	}
	.style:hover {
		background: rgb(0 0 0 / 0.65);
	}
	.style:focus-visible {
		outline: 2px solid #fff;
		outline-offset: 2px;
	}
	.style kbd {
		margin-left: 6px;
		padding: 0 5px;
		border: 1px solid rgb(255 255 255 / 0.4);
		border-radius: 4px;
		font: inherit;
		font-size: 11px;
		opacity: 0.8;
	}
	.status {
		top: 12px;
		left: 12px;
		white-space: pre;
	}
	.help {
		bottom: 12px;
		left: 12px;
		opacity: 0.8;
	}
	.failure {
		inset: 0;
		display: grid;
		place-items: center;
		padding: 24px;
		font-size: 16px;
		text-align: center;
	}
</style>
