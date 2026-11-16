<script lang="ts">
	import type { Attachment } from 'svelte/attachments'

	import { RING_RADIUS } from './course'
	import { drawMinimap, easeView, fitView, type MapView, type MinimapData } from './minimap'

	type Props = {
		/** gọi mỗi lần vẽ để lấy trạng thái mới nhất */
		source: () => MinimapData
		/** cạnh bản đồ theo CSS px */
		size?: number
	}

	let { source, size = 200 }: Props = $props()

	// vẽ ~15 khung/giây là đủ mượt cho bản đồ, đỡ tốn CPU
	const FRAME_MS = 1000 / 15
	// khung nhìn tối thiểu: thấy trọn đường vòng bay, chừa mép dưới cho thước tỉ lệ
	const MIN_HALF = RING_RADIUS * 1.4

	const mount: Attachment<HTMLCanvasElement> = (canvas) => {
		const ctx = canvas.getContext('2d')
		if (!ctx) return
		const dpr = Math.min(devicePixelRatio, 2)
		canvas.width = Math.round(size * dpr)
		canvas.height = Math.round(size * dpr)
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

		let view: MapView | null = null
		let last = -Infinity
		let raf = 0
		const frame = (now: number) => {
			raf = requestAnimationFrame(frame)
			if (now - last < FRAME_MS) return
			last = now
			const d = source()
			const ringPoints = d.rings.map((r) => r.position)
			const target = fitView([ringPoints, d.trail, [d.position]], MIN_HALF)
			view = view ? easeView(view, target, 0.2) : target
			drawMinimap(ctx, size, view, d)
		}
		raf = requestAnimationFrame(frame)
		return () => cancelAnimationFrame(raf)
	}
</script>

<canvas
	class="minimap"
	style:width="{size}px"
	style:height="{size}px"
	aria-label="Mini map: quỹ đạo bay nhìn từ trên xuống"
	{@attach mount}
></canvas>

<style>
	.minimap {
		display: block;
		border: 1px solid rgb(125 255 176 / 0.25);
		border-radius: 8px;
		backdrop-filter: blur(4px);
	}
</style>
