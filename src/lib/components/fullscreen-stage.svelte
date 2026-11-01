<script lang="ts">
	import { onMount, type Snippet } from 'svelte'

	let { label, children }: { label: string; children: Snippet } = $props()

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

<!-- phủ toàn bộ màn hình dưới header; con đặt absolute bên trong để nổi lên trên -->
<section
	aria-label={label}
	class="fixed inset-x-0 bottom-0 z-0 bg-slate-950"
	style:top="{headerBottom}px"
>
	{@render children()}
</section>
