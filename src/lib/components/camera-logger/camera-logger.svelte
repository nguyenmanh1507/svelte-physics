<script lang="ts">
	import { useThrelte, useTask } from '@threlte/core'
	import * as THREE from 'three'

	const { camera } = useThrelte()

	function portal(node: HTMLElement) {
		document.body.appendChild(node)
		return {
			destroy() {
				node.remove()
			},
		}
	}

	let pos = $state({ x: 0, y: 0, z: 0 })
	let rot = $state({ x: 0, y: 0, z: 0 })
	let fov = $state(75)
	let near = $state(0.1)
	let far = $state(1000)
	let copied = $state(false)

	const r = (n: number) => Math.round(n * 100) / 100

	useTask(() => {
		const cam = camera.current
		if (!cam) return

		pos = { x: r(cam.position.x), y: r(cam.position.y), z: r(cam.position.z) }
		rot = { x: r(cam.rotation.x), y: r(cam.rotation.y), z: r(cam.rotation.z) }

		if (cam instanceof THREE.PerspectiveCamera) {
			fov = r(cam.fov)
			near = r(cam.near)
			far = r(cam.far)
		}
	})

	function copy() {
		const snippet = `<T.PerspectiveCamera\n  position={[${pos.x}, ${pos.y}, ${pos.z}]}\n  rotation={[${rot.x}, ${rot.y}, ${rot.z}]}\n  fov={${fov}}\n  near={${near}}\n  far={${far}}\n  makeDefault\n/>`
		navigator.clipboard.writeText(snippet).then(() => {
			copied = true
			setTimeout(() => (copied = false), 1500)
		})
	}
</script>

<div use:portal class="camera-logger">
	<div class="header">
		<span>Camera</span>
		<button onclick={copy}>{copied ? '✓ Copied' : 'Copy'}</button>
	</div>
	<div class="row">
		<span class="label">pos</span>
		<span class="val">x: {pos.x}</span>
		<span class="val">y: {pos.y}</span>
		<span class="val">z: {pos.z}</span>
	</div>
	<div class="row">
		<span class="label">rot</span>
		<span class="val">x: {rot.x}</span>
		<span class="val">y: {rot.y}</span>
		<span class="val">z: {rot.z}</span>
	</div>
	<div class="row">
		<span class="label">fov</span>
		<span class="val">{fov}</span>
		<span class="label">near</span>
		<span class="val">{near}</span>
		<span class="label">far</span>
		<span class="val">{far}</span>
	</div>
</div>

<style>
	.camera-logger {
		position: fixed;
		bottom: 12px;
		right: 12px;
		z-index: 1000;
		background: rgba(0, 0, 0, 0.75);
		color: #e0e0e0;
		font-family: monospace;
		font-size: 11px;
		padding: 8px 10px;
		border-radius: 6px;
		min-width: 260px;
		user-select: none;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 5px;
		font-size: 12px;
		font-weight: bold;
		color: #fff;
	}

	button {
		background: rgba(255, 255, 255, 0.15);
		border: none;
		color: #e0e0e0;
		font-family: monospace;
		font-size: 11px;
		padding: 2px 8px;
		border-radius: 3px;
		cursor: pointer;
	}

	button:hover {
		background: rgba(255, 255, 255, 0.25);
	}

	.row {
		display: flex;
		gap: 8px;
		margin-top: 3px;
	}

	.label {
		color: #888;
		min-width: 20px;
	}

	.val {
		color: #7ec8e3;
		min-width: 55px;
	}
</style>
