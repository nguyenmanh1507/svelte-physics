<script lang="ts">
	import CityRoads from './components/city-roads.svelte'
	import { ROAD_ASSETS } from './components/road-assets'
	import { gallery, ROAD_MAP } from './components/road-map'

	let showGallery = $state(false)
	let showClouds = $state(true)
	let info = $state({ assets: 0, instances: 0 })
</script>

<section
	aria-label="Thành phố"
	class="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] xl:gap-6"
>
	<section
		aria-label="Bản đồ đường"
		class="min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-2 shadow-xl ring-1 shadow-slate-950/15 ring-white/5 sm:p-3"
	>
		{#key showGallery}
			<CityRoads
				placements={showGallery ? gallery() : ROAD_MAP}
				labels={showGallery}
				clouds={showClouds && !showGallery}
				onload={(i) => (info = i)}
			/>
		{/key}
	</section>

	<aside
		aria-label="Thông tin bản đồ"
		class="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-slate-100 shadow-xl ring-1 shadow-slate-950/15 ring-white/5"
	>
		<header class="border-b border-slate-800 px-4 py-4">
			<p class="font-mono text-xs font-medium tracking-[0.18em] text-cyan-400 uppercase">
				City Kit – Roads
			</p>
			<h1 class="mt-1 text-lg font-semibold tracking-tight">Đường thành phố</h1>
			<p class="mt-1 text-sm leading-5 text-slate-400">
				Lưới 30 × 30 ô, mỗi ô 10 unit – tổng 300 × 300. Kéo để xoay, cuộn để zoom.
			</p>
		</header>

		<dl class="grid grid-cols-2 gap-3 border-b border-slate-800 p-4 text-sm">
			<div class="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
				<dt class="text-slate-400">Loại asset</dt>
				<dd class="font-mono text-base font-semibold text-cyan-300 tabular-nums">
					{info.assets}/{ROAD_ASSETS.length}
				</dd>
			</div>
			<div class="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
				<dt class="text-slate-400">Instance</dt>
				<dd class="font-mono text-base font-semibold text-cyan-300 tabular-nums">
					{info.instances}
				</dd>
			</div>
		</dl>

		<footer class="grid gap-2 p-4">
			<button
				type="button"
				aria-pressed={showClouds}
				disabled={showGallery}
				class="w-full rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none disabled:opacity-40 {showClouds
					? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-50'
					: 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600 hover:bg-slate-800'}"
				onclick={() => (showClouds = !showClouds)}
			>
				Mây thể tích: {showClouds ? 'bật' : 'tắt'}
			</button>
			<button
				type="button"
				aria-pressed={showGallery}
				class="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none"
				onclick={() => (showGallery = !showGallery)}
			>
				{showGallery ? 'Xem bản đồ' : 'Xem toàn bộ asset'}
			</button>
		</footer>
	</aside>
</section>
