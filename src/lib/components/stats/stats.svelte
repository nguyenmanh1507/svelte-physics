<script lang="ts">
	import Stats from 'stats.js'
	import { onMount } from 'svelte'

	let statsRef: HTMLDivElement | undefined

	onMount(() => {
		if (!statsRef) return

		const statsFPS = new Stats()
		statsFPS.showPanel(0)
		statsFPS.dom.style.cssText = 'position: fixed; bottom: 0; left: 0; z-index: 1000;'
		document.body.appendChild(statsFPS.dom)

		const statsRenderTime = new Stats()
		statsRenderTime.showPanel(1)
		statsRenderTime.dom.style.cssText = 'position: fixed; bottom: 0; left: 80px; z-index: 1000;'
		document.body.appendChild(statsRenderTime.dom)

		const statsMemory = new Stats()
		statsMemory.showPanel(2)
		statsMemory.dom.style.cssText = 'position: fixed; bottom: 0; left: 160px; z-index: 1000;'
		document.body.appendChild(statsMemory.dom)

		function update() {
			statsFPS.begin()
			statsRenderTime.begin()
			statsMemory.begin()

			statsFPS.end()
			statsRenderTime.end()
			statsMemory.end()

			requestAnimationFrame(update)
		}

		const raf = requestAnimationFrame(update)

		return () => {
			cancelAnimationFrame(raf)
			statsFPS.dom.remove()
		}
	})
</script>

<div bind:this={statsRef}></div>
