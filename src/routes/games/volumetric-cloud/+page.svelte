<script lang="ts">
	import VolumeCanvas from './components/volumetric-cloud.svelte'
	import { defaultParams, type VolumeParams } from './components/params'

	const stepNames = [
		'1. Giao tia - cầu',
		"2. Beer's law",
		'3. Ray-marching',
		'4. Phase function',
		'5. Mây (noise)',
	]

	// Mỗi bước dùng một mô hình ánh sáng khác nhau nên cần bộ số khởi đầu riêng.
	const presets: Record<number, Partial<VolumeParams>> = {
		3: { sigmaA: 1.5, lightIntensity: 0.8 },
		4: { sigmaA: 0.5, sigmaS: 2, lightIntensity: 12 },
		5: { sigmaA: 0.02, sigmaS: 6, g: 0.3, lightIntensity: 12 },
	}

	let step = $state(1)
	let params: VolumeParams = $state({ ...defaultParams })

	function selectStep(n: number) {
		step = n
		params = { ...defaultParams, ...presets[n] }
	}

	type Slider = {
		key: keyof VolumeParams
		label: string
		min: number
		max: number
		step: number
		from: number // slider xuất hiện từ bước nào
	}

	const sliders: Slider[] = [
		{ key: 'sigmaA', label: 'σa hấp thụ', min: 0, max: 5, step: 0.01, from: 2 },
		{ key: 'sigmaS', label: 'σs tán xạ', min: 0, max: 10, step: 0.01, from: 4 },
		{ key: 'g', label: 'g (phase)', min: -0.9, max: 0.9, step: 0.01, from: 4 },
		{ key: 'lightIntensity', label: 'Cường độ đèn', min: 0, max: 40, step: 0.1, from: 3 },
		{ key: 'lightAzimuth', label: 'Đèn: góc quay', min: -180, max: 180, step: 1, from: 3 },
		{ key: 'lightElevation', label: 'Đèn: góc cao', min: -89, max: 89, step: 1, from: 3 },
		{ key: 'steps', label: 'Số bước', min: 1, max: 128, step: 1, from: 3 },
		{ key: 'lightSteps', label: 'Số bước về đèn', min: 1, max: 32, step: 1, from: 5 },
		{ key: 'noiseScale', label: 'Tần số noise', min: 0.5, max: 8, step: 0.1, from: 5 },
	]
</script>

<section
	aria-label="Trình mô phỏng mây thể tích"
	class="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] xl:gap-6"
>
	<section
		aria-label="Mô phỏng mây thể tích"
		class="min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-2 shadow-xl ring-1 shadow-slate-950/15 ring-white/5 sm:p-3"
	>
		<VolumeCanvas {step} {params} />
	</section>

	<aside
		aria-label="Điều khiển mô phỏng"
		class="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-slate-100 shadow-xl ring-1 shadow-slate-950/15 ring-white/5"
	>
		<header class="border-b border-slate-800 px-4 py-4">
			<p class="font-mono text-xs font-medium tracking-[0.18em] text-cyan-400 uppercase">
				Shader inspector
			</p>
			<h1 class="mt-1 text-lg font-semibold tracking-tight">Volumetric Cloud</h1>
			<p class="mt-1 text-sm leading-5 text-slate-400">
				Chọn từng bước dựng hình và tinh chỉnh các thông số mô phỏng.
			</p>
		</header>

		<nav aria-label="Các bước dựng hình" class="grid gap-2 border-b border-slate-800 p-4">
			{#each stepNames as name, i (i)}
				<button
					type="button"
					aria-pressed={step === i + 1}
					class="flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none {step ===
					i + 1
						? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-50 shadow-sm shadow-cyan-950/50'
						: 'border-slate-800 bg-slate-900/70 text-slate-400 hover:border-slate-700 hover:bg-slate-900 hover:text-slate-100'}"
					onclick={() => selectStep(i + 1)}
				>
					<span
						aria-hidden="true"
						class="size-2 shrink-0 rounded-full {step === i + 1
							? 'bg-cyan-300 shadow-[0_0_0.75rem_rgba(103,232,249,0.8)]'
							: 'bg-slate-600'}"
					></span>
					<span class="font-medium">{name}</span>
				</button>
			{/each}
		</nav>

		<div class="grid gap-4 p-4 empty:hidden">
			{#each sliders.filter((s) => step >= s.from) as s (s.key)}
				<label class="grid gap-2">
					<span class="flex items-center justify-between gap-3 text-sm">
						<span class="font-medium text-slate-300">{s.label}</span>
						<output
							class="min-w-14 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-right font-mono text-xs leading-none font-semibold text-cyan-300 tabular-nums"
						>
							{params[s.key]}
						</output>
					</span>
					<input
						class="h-6 w-full cursor-pointer accent-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none"
						type="range"
						min={s.min}
						max={s.max}
						step={s.step}
						bind:value={params[s.key]}
					/>
				</label>
			{/each}
		</div>

		<footer class="border-t border-slate-800 p-4">
			<button
				type="button"
				class="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none"
				onclick={() => selectStep(step)}
			>
				Đặt lại thông số
			</button>
		</footer>
	</aside>
</section>
