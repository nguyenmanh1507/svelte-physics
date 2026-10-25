<script lang="ts">
	import { onMount } from 'svelte'
	import CityRoads from './components/city-roads.svelte'
	import CloudControls from './components/cloud-controls.svelte'
	import { ROAD_ASSETS } from './components/road-assets'
	import { BUILDING_MAP } from './components/building-map'
	import { gallery, ROAD_MAP } from './components/road-map'
	import { citySky } from './components/sky-config'

	let showGallery = $state(false)
	let showClouds = $state(true)
	let info = $state({ assets: 0, instances: 0, buildings: 0 })
	// ở page nên giữ nguyên khi chuyển gallery (CityRoads bị dựng lại)
	let sky = $state(citySky())
	let showPanel = $state(true)
	let toon = $state(true)
	let headerBottom = $state(64)

	onMount(() => {
		const root = document.documentElement
		const prev = { gutter: root.style.scrollbarGutter, overflow: root.style.overflow }
		// trang toàn màn hình: không cuộn, không chừa chỗ thanh cuộn (layout.css đặt gutter stable)
		root.style.scrollbarGutter = 'auto'
		root.style.overflow = 'hidden'

		// navbar xuống dòng trên màn hẹp -> đo chiều cao thật thay vì cố định 4rem
		const nav = document.querySelector('.navbar')
		const observer = new ResizeObserver(() => {
			if (nav) headerBottom = nav.getBoundingClientRect().bottom
		})
		if (nav) observer.observe(nav)

		return () => {
			observer.disconnect()
			root.style.scrollbarGutter = prev.gutter
			root.style.overflow = prev.overflow
		}
	})
</script>

<!-- canvas phủ toàn bộ màn hình dưới header, aside nổi bên phải -->
<section
	aria-label="Thành phố"
	class="fixed inset-x-0 bottom-0 z-0 bg-slate-950"
	style:top="{headerBottom}px"
>
	<section aria-label="Bản đồ đường" class="h-full w-full">
		{#key showGallery}
			<CityRoads
				class="h-full w-full"
				placements={showGallery ? gallery() : ROAD_MAP}
				buildings={showGallery ? [] : BUILDING_MAP}
				{toon}
				labels={showGallery}
				clouds={showClouds && !showGallery}
				{sky}
				onload={(i) => (info = i)}
			/>
		{/key}
	</section>

	{#if !showPanel}
		<button
			type="button"
			aria-controls="city-panel"
			aria-expanded="false"
			class="absolute top-3 right-3 rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm font-semibold text-slate-100 shadow-xl backdrop-blur hover:bg-slate-900 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
			onclick={() => (showPanel = true)}
		>
			Bảng điều khiển
		</button>
	{/if}

	<aside
		id="city-panel"
		aria-label="Thông tin bản đồ"
		hidden={!showPanel}
		class="absolute top-0 right-0 bottom-0 w-80 max-w-[85vw] overflow-y-auto border-l border-slate-800 bg-slate-950/85 text-slate-100 shadow-2xl backdrop-blur"
	>
		<header class="relative border-b border-slate-800 px-4 py-4">
			<button
				type="button"
				aria-controls="city-panel"
				aria-expanded="true"
				aria-label="Ẩn bảng điều khiển"
				class="absolute top-3 right-3 grid size-8 place-items-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
				onclick={() => (showPanel = false)}
			>
				✕
			</button>
			<p class="font-mono text-xs font-medium tracking-[0.18em] text-cyan-400 uppercase">
				City Kit – Roads
			</p>
			<h1 class="mt-1 text-lg font-semibold tracking-tight">Đường thành phố</h1>
			<p class="mt-1 text-sm leading-5 text-slate-400">
				Lưới 30 × 30 ô, mỗi ô 10 unit – tổng 300 × 300. Kéo để xoay, cuộn để zoom.
			</p>
		</header>

		<dl class="grid grid-cols-3 gap-2 border-b border-slate-800 p-4 text-sm">
			<div class="rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-2">
				<dt class="text-slate-400">Loại asset</dt>
				<dd class="font-mono text-base font-semibold text-cyan-300 tabular-nums">
					{info.assets}/{ROAD_ASSETS.length}
				</dd>
			</div>
			<div class="rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-2">
				<dt class="text-slate-400">Building</dt>
				<dd class="font-mono text-base font-semibold text-cyan-300 tabular-nums">
					{info.buildings}
				</dd>
			</div>
			<div class="rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-2">
				<dt class="text-slate-400">Instance</dt>
				<dd class="font-mono text-base font-semibold text-cyan-300 tabular-nums">
					{info.instances}
				</dd>
			</div>
		</dl>

		<div class="grid gap-2 border-b border-slate-800 p-4">
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
				aria-pressed={toon}
				class="w-full rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none {toon
					? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-50'
					: 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600 hover:bg-slate-800'}"
				onclick={() => (toon = !toon)}
			>
				Cel shading: {toon ? 'bật' : 'tắt'}
			</button>
			<button
				type="button"
				aria-pressed={showGallery}
				class="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none"
				onclick={() => (showGallery = !showGallery)}
			>
				{showGallery ? 'Xem bản đồ' : 'Xem toàn bộ asset'}
			</button>
		</div>

		<section aria-labelledby="cloud-config-title">
			<header class="px-4 pt-4">
				<p class="font-mono text-xs font-medium tracking-[0.18em] text-cyan-400 uppercase">Nubis</p>
				<h2 id="cloud-config-title" class="mt-1 text-base font-semibold tracking-tight">
					Cấu hình mây
				</h2>
				<p class="mt-1 text-sm leading-5 text-slate-400">
					Độ dài tính bằng mét, nhân với tỉ lệ để ra unit của scene.
				</p>
			</header>
			<CloudControls bind:params={sky} disabled={!showClouds || showGallery} />
		</section>
	</aside>
</section>
