<script lang="ts">
	import type { Attachment } from 'svelte/attachments'

	import { createIsleScene, type IsleScene, type IsleSettings } from './world/create-isle-scene'

	type Props = {
		settings: IsleSettings
		onwatertap?: () => void
	}

	let { settings, onwatertap }: Props = $props()

	let isle: IsleScene | null = null

	export function sendBigWave() {
		isle?.sendBigWave()
	}

	const mountScene: Attachment<HTMLElement> = (host) => {
		const scene = createIsleScene(host, { onWaterTap: () => onwatertap?.() })
		if (!scene) return
		isle = scene

		// attachment cũng chạy trong effect: đọc state ở đây sẽ dựng lại cả scene, nên phải tách effect riêng
		$effect(() => {
			scene.applySettings(settings)
		})

		return () => {
			isle = null
			scene.dispose()
		}
	}
</script>

<div class="absolute inset-0 isolate" {@attach mountScene}></div>
