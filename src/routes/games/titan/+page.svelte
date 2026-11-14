<script lang="ts">
	import FullscreenStage from '#lib/components/fullscreen-stage.svelte'

	import TitanCanvas from './components/titan-canvas.svelte'
	import type { TitanSettings } from './components/world/create-titan-scene'

	let settings = $state<TitanSettings>({ wind: 1, rain: 0.3, haze: 1 })
	let unsupported = $state(false)

	const sliders = [
		{ key: 'wind', label: 'Gió', min: 0, max: 4, step: 0.1 },
		{ key: 'rain', label: 'Mưa metan', min: 0, max: 1, step: 0.05 },
		{ key: 'haze', label: 'Sương mù', min: 0.4, max: 2.5, step: 0.1 },
	] as const

	// số liệu theo NASA Science (science.nasa.gov/saturn/moons/titan/facts)
	const facts = [
		['Nhiệt độ bề mặt', '−179 °C'],
		['Áp suất', 'cao hơn Trái Đất ~60%'],
		['Ánh sáng Mặt Trời', 'yếu hơn ~100 lần'],
		['Hồ và mưa', 'metan + etan lỏng'],
		['Đá gốc', 'băng nước'],
	] as const
</script>

<FullscreenStage label="Bờ hồ metan trên Titan">
	{#if unsupported}
		<p class="absolute inset-0 grid place-items-center p-6 text-center text-white">
			Trình duyệt này chưa hỗ trợ WebGL2 nên không dựng được khung cảnh.
		</p>
	{:else}
		<TitanCanvas {settings} onunsupported={() => (unsupported = true)} />

		<div
			class="absolute top-3 left-3 w-60 rounded-lg bg-black/45 p-3 text-xs text-orange-50 backdrop-blur-sm"
		>
			<h1 class="text-sm font-semibold">Titan · bờ hồ metan</h1>
			<p class="mt-0.5 opacity-75">Mặt trăng lớn nhất của Sao Thổ</p>

			<div class="mt-3 grid gap-2">
				{#each sliders as slider (slider.key)}
					<label class="grid gap-1">
						<span class="flex justify-between">
							{slider.label}
							<span class="tabular-nums opacity-75">{settings[slider.key].toFixed(2)}</span>
						</span>
						<input
							type="range"
							class="range range-xs"
							min={slider.min}
							max={slider.max}
							step={slider.step}
							bind:value={settings[slider.key]}
						/>
					</label>
				{/each}
			</div>

			<dl class="mt-3 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 border-t border-white/20 pt-2">
				{#each facts as [name, value] (name)}
					<dt class="opacity-75">{name}</dt>
					<dd class="text-right">{value}</dd>
				{/each}
			</dl>
		</div>

		<p
			class="pointer-events-none absolute bottom-3 left-3 text-xs text-white/80 [text-shadow:0_1px_2px_rgb(0_0_0/0.7)]"
		>
			Kéo chuột để xoay · cuộn để zoom · chuột phải hoặc W/A/S/D để di chuyển quanh hồ (Shift: nhanh
			hơn)
		</p>
	{/if}
</FullscreenStage>
