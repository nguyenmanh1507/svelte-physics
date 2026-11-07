<script lang="ts">
	import type { Attachment } from 'svelte/attachments'

	import {
		createPondScene,
		type PondScene,
		type PondSettings,
		type PondStats,
	} from './world/create-pond-scene'

	type Props = {
		settings: PondSettings
		onstats?: (stats: PondStats) => void
	}

	let { settings, onstats }: Props = $props()

	let pond: PondScene | null = null
	let unsupported = $state(false)

	export function feed() {
		pond?.feed()
	}

	export function throwStone() {
		pond?.throwStone()
	}

	const mountScene: Attachment<HTMLElement> = (host) => {
		const scene = createPondScene(host, { onStats: (s) => onstats?.(s) })
		if (!scene) {
			unsupported = true
			return
		}
		pond = scene

		// attachment cũng chạy trong effect: đọc state ở đây sẽ dựng lại cả scene, nên phải tách effect riêng
		$effect(() => {
			scene.applySettings({ ...settings })
		})

		return () => {
			pond = null
			scene.dispose()
		}
	}
</script>

<div class="absolute inset-0 isolate" {@attach mountScene}></div>
{#if unsupported}
	<p class="absolute inset-0 grid place-items-center p-6 text-center">
		Trình duyệt này không hỗ trợ WebGL2, nên không chạy được mô phỏng.
	</p>
{/if}
