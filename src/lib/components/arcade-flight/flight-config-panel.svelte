<!-- Chỉnh config máy bay dạng JSON (data-driven): áp dụng ngay khi đang bay -->
<script lang="ts">
	import { cloneConfig, derived as derivedSpeeds, parseConfig, type AircraftConfig } from './core'

	let {
		config,
		defaults,
		onapply,
	}: {
		config: AircraftConfig
		/** config gốc cho nút "Về mặc định" */
		defaults: AircraftConfig
		onapply: (c: AircraftConfig) => void
	} = $props()

	let text = $state('')
	let note = $state<{ text: string; error: boolean } | null>(null)

	// đổi máy bay / áp dụng xong → nạp lại nội dung ô soạn thảo
	$effect.pre(() => {
		text = JSON.stringify(config, null, 2)
		note = null
	})

	const d = $derived(derivedSpeeds(config))
	const kmh = (v: number | null) => (v ? `${Math.round(v * 3.6)} km/h` : '—')

	function apply() {
		try {
			onapply(parseConfig(text))
		} catch (e) {
			note = { text: `JSON lỗi: ${e instanceof Error ? e.message : String(e)}`, error: true }
		}
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(text)
			note = { text: 'Đã copy.', error: false }
		} catch {
			note = { text: 'Trình duyệt chặn clipboard — hãy chọn và copy thủ công.', error: true }
		}
	}
</script>

<div class="cfg">
	<h3>Config máy bay (JSON, data-driven)</h3>
	<p class="derived">
		Suy ra: corner speed (curve ∩ G) ≈ {kmh(d.cornerFromCurve)} · (lift) ≈ {kmh(d.cornerFromLift)} · Vmax
		AB ≈ {kmh(d.vMaxAB)}
	</p>
	<textarea bind:value={text} spellcheck="false" aria-label="Config máy bay dạng JSON"></textarea>
	<p class="note" class:error={note?.error}>{note?.text ?? ''}</p>
	<div class="actions">
		<button type="button" onclick={apply}>Áp dụng</button>
		<button type="button" onclick={() => onapply(cloneConfig(defaults))}>Về mặc định</button>
		<button type="button" onclick={copy}>Copy JSON</button>
	</div>
	<p class="hint">
		Cùng một lõi <code>stepFlight()</code> chạy mọi loại máy bay: chỉ khác file config. Đơn vị: m/s,
		deg/s, rate là curve <code>[[tốc độ, deg/s], …]</code>. Bỏ một khoá trong
		<code>maneuvers</code> để tắt maneuver đó.
	</p>
</div>

<style>
	.cfg {
		font-size: 13px;
		line-height: 1.5;
	}
	h3 {
		margin: 4px 0 8px;
		font-size: 15px;
		font-weight: 700;
	}
	.derived {
		margin: 0 0 6px;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		color: rgb(125 255 176 / 0.55);
		font-size: 12px;
	}
	textarea {
		width: 100%;
		height: 52vh;
		background: #050b10;
		color: #cfe;
		border: 1px solid rgb(125 255 176 / 0.25);
		border-radius: 6px;
		font:
			12px/1.45 'JetBrains Mono',
			ui-monospace,
			monospace;
		padding: 8px;
		resize: vertical;
	}
	.note {
		min-height: 1.2em;
		margin: 2px 0;
		font-size: 12px;
		color: #7dffb0;
	}
	.note.error {
		color: #ff5b5b;
	}
	.actions {
		display: flex;
		gap: 6px;
		margin-top: 6px;
	}
	button {
		font-size: 12.5px;
		color: #e8f3ee;
		background: rgb(8 16 22 / 0.62);
		border: 1px solid rgb(125 255 176 / 0.25);
		border-radius: 6px;
		padding: 6px 10px;
		cursor: pointer;
	}
	button:hover,
	button:focus-visible {
		border-color: #7dffb0;
	}
	.hint {
		color: #b9cbc4;
		font-size: 12px;
	}
</style>
