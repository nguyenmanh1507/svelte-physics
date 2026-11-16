<!-- Cần ảo + nút maneuver cho màn hình cảm ứng; ghi thẳng vào FlightInput -->
<script lang="ts">
	import type { FlightAction } from './core'
	import type { FlightInput } from './three/flight-input'

	let { input, onmode, onreset }: { input: FlightInput; onmode: () => void; onreset: () => void } =
		$props()

	type TouchButton = { label: string; action?: FlightAction; tap?: () => void; double?: boolean }
	const buttons: TouchButton[] = [
		{ label: 'SPLIT-S', action: 'splitS' },
		{ label: 'IMMEL', action: 'immelmann' },
		{ label: 'PSM', action: 'arm' },
		{ label: '◀ ROLL', action: 'rollL', double: true },
		{ label: 'ROLL ▶', action: 'rollR', double: true },
		{ label: 'MODE', tap: () => onmode() },
		{ label: 'BRAKE', action: 'brake' },
		{ label: 'BOOST', action: 'boost' },
		{ label: 'RESET', tap: () => onreset() },
	]

	let stickEl: HTMLDivElement
	let stickId: number | null = null
	let knob = $state({ x: 0, y: 0 })
	const KNOB_TRAVEL = 47

	function moveStick(e: PointerEvent) {
		const r = stickEl.getBoundingClientRect()
		let dx = (e.clientX - r.left - r.width / 2) / (r.width / 2)
		let dy = (e.clientY - r.top - r.height / 2) / (r.height / 2)
		const m = Math.hypot(dx, dy)
		if (m > 1) {
			dx /= m
			dy /= m
		}
		knob = { x: dx, y: dy }
		input.setStick(dx, dy)
	}

	function endStick(e: PointerEvent) {
		if (e.pointerId !== stickId) return
		stickId = null
		knob = { x: 0, y: 0 }
		input.setStick(0, 0)
	}

	function down(e: PointerEvent, b: TouchButton) {
		e.preventDefault()
		;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
		if (b.tap) b.tap()
		else if (b.action && b.double) input.doubleTap(b.action)
		else if (b.action) input.press(b.action)
	}

	function up(b: TouchButton) {
		if (b.action) input.release(b.action)
	}
</script>

<div class="touch">
	<div
		class="stick"
		bind:this={stickEl}
		role="slider"
		aria-label="Cần điều khiển"
		aria-valuenow={Math.round(knob.y * 100)}
		tabindex="-1"
		onpointerdown={(e) => {
			stickId = e.pointerId
			stickEl.setPointerCapture(e.pointerId)
			moveStick(e)
		}}
		onpointermove={(e) => e.pointerId === stickId && moveStick(e)}
		onpointerup={endStick}
		onpointercancel={endStick}
	>
		<div
			class="knob"
			style:transform="translate({knob.x * KNOB_TRAVEL}px, {knob.y * KNOB_TRAVEL}px)"
		></div>
	</div>
	<div class="buttons">
		{#each buttons as b (b.label)}
			<button
				type="button"
				onpointerdown={(e) => down(e, b)}
				onpointerup={() => up(b)}
				onpointercancel={() => up(b)}>{b.label}</button
			>
		{/each}
	</div>
</div>

<style>
	.touch {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 4;
	}
	.stick {
		position: absolute;
		left: 22px;
		bottom: 22px;
		width: 150px;
		height: 150px;
		border-radius: 50%;
		border: 2px solid rgb(125 255 176 / 0.25);
		background: rgb(8 16 22 / 0.35);
		pointer-events: auto;
		touch-action: none;
	}
	.knob {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 56px;
		height: 56px;
		margin: -28px 0 0 -28px;
		border-radius: 50%;
		background: rgb(125 255 176 / 0.35);
		border: 1px solid #7dffb0;
	}
	.buttons {
		position: absolute;
		right: 16px;
		bottom: 18px;
		display: grid;
		grid-template-columns: repeat(3, 72px);
		gap: 8px;
		pointer-events: auto;
	}
	button {
		height: 56px;
		padding: 0;
		font-size: 12px;
		color: #e8f3ee;
		background: rgb(8 16 22 / 0.62);
		border: 1px solid rgb(125 255 176 / 0.25);
		border-radius: 6px;
		touch-action: none;
		user-select: none;
	}
	button:active {
		border-color: #7dffb0;
		background: rgb(125 255 176 / 0.18);
	}
	@media (max-width: 640px) {
		.buttons {
			grid-template-columns: repeat(3, 58px);
			gap: 6px;
		}
		button {
			height: 46px;
			font-size: 10.5px;
		}
		.stick {
			width: 128px;
			height: 128px;
			left: 14px;
			bottom: 18px;
		}
	}
</style>
