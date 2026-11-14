<script lang="ts">
	import type { Attachment } from 'svelte/attachments'

	import { createTitanScene, type TitanSettings } from './world/create-titan-scene'

	type Props = {
		settings: TitanSettings
		onunsupported?: () => void
	}

	let { settings, onunsupported }: Props = $props()

	const mountScene: Attachment<HTMLElement> = (host) => {
		const scene = createTitanScene(host)
		if (!scene) {
			onunsupported?.()
			return
		}

		// attachment cũng chạy trong effect: đọc state ở đây sẽ dựng lại cả scene, nên phải tách effect riêng
		$effect(() => {
			scene.applySettings(settings)
		})

		return () => scene.dispose()
	}
</script>

<div class="absolute inset-0 isolate" {@attach mountScene}></div>
