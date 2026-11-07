<script lang="ts">
	import FullscreenStage from '#lib/components/fullscreen-stage.svelte'
	import { createAreas, type AreaId } from './components/areas'
	import HotelViewer from './components/hotel-viewer.svelte'

	const areas = createAreas()
	let area: AreaId = $state('room')

	// phím 1/2/3 đổi khu ngay cả khi đang khoá chuột
	function onkeydown(e: KeyboardEvent) {
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
		const index = Number(e.key) - 1
		if (Number.isInteger(index) && areas[index]) area = areas[index].id
	}
</script>

<svelte:window {onkeydown} />

<!-- canvas phủ toàn bộ màn hình dưới header, menu chọn khu nổi góc trái -->
<FullscreenStage label="Tham quan khách sạn 3D">
	<HotelViewer {areas} {area} class="h-full w-full" />

	<nav
		aria-label="Chọn khu vực"
		class="absolute top-3 left-3 w-72 max-w-[calc(100vw-1.5rem)] rounded-xl border border-white/10 bg-slate-950/75 p-3 text-slate-100 shadow-2xl backdrop-blur"
	>
		<p class="font-mono text-xs font-medium tracking-[0.18em] text-cyan-300 uppercase">
			Tham quan trước khi đặt
		</p>
		<h1 class="mt-0.5 text-lg font-semibold tracking-tight">Khách sạn hướng biển</h1>
		<ul class="mt-3 grid gap-1.5">
			{#each areas as a, i (a.id)}
				<li>
					<button
						type="button"
						aria-pressed={area === a.id}
						class="flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none {area ===
						a.id
							? 'border-cyan-400/60 bg-cyan-400/15'
							: 'border-transparent hover:bg-white/10'}"
						onclick={() => (area = a.id)}
					>
						<kbd
							class="mt-0.5 grid size-5 shrink-0 place-items-center rounded border border-white/20 font-mono text-[11px] text-slate-300"
							>{i + 1}</kbd
						>
						<span>
							<span class="block text-sm font-semibold">{a.label}</span>
							<span class="block text-xs text-slate-400">{a.caption}</span>
						</span>
					</button>
				</li>
			{/each}
		</ul>
	</nav>
</FullscreenStage>
