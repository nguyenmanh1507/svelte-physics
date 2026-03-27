# BabylonJS Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up a BabylonJS basic scene (rotating cube, ground plane, arc-rotate camera, hemispheric light) in the existing `src/routes/babylonjs/+page.svelte` stub.

**Architecture:** Install `@babylonjs/core`, mount the BabylonJS engine on a `<canvas>` element inside `onMount`, and clean up on destroy. The scene and all BabylonJS logic lives entirely in the single page component.

**Tech Stack:** SvelteKit 2, Svelte 5, TypeScript, `@babylonjs/core` v6+, pnpm, Tailwind CSS / DaisyUI

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/routes/babylonjs/+page.svelte` | Modify | BabylonJS scene: engine mount, scene setup, cleanup |
| `src/lib/components/page-header.svelte` | Modify | Add BabylonJS nav entry |

---

### Task 1: Install `@babylonjs/core`

**Files:**
- Modify: `package.json` (via pnpm)

- [ ] **Step 1: Install the package**

```bash
pnpm add @babylonjs/core
```

Expected output: package added, `package.json` `dependencies` now includes `"@babylonjs/core": "^x.x.x"`.

- [ ] **Step 2: Verify install**

```bash
pnpm list @babylonjs/core
```

Expected: one line showing the installed version.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat: install @babylonjs/core"
```

---

### Task 2: Add BabylonJS to the nav

**Files:**
- Modify: `src/lib/components/page-header.svelte` (line ~124 — after the closing `]` of the last child array in `menuItems`)

- [ ] **Step 1: Open `src/lib/components/page-header.svelte` and locate the `menuItems` array**

The array ends around line 124 with `]`. The last entry is the `JS Physics` dropdown.

- [ ] **Step 2: Add a top-level `MenuLink` entry for BabylonJS**

After the `JS Physics` entry (before the closing `]` of `menuItems`), add:

```ts
	{
		label: 'BabylonJS',
		href: '/babylonjs',
	},
```

The result should look like:

```ts
	{
		label: 'JS Physics',
		children: [
			{
				label: 'Bouncing Ball',
				href: '/js-physics/bouncing-ball',
			},
		],
	},
	{
		label: 'BabylonJS',
		href: '/babylonjs',
	},
]
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/page-header.svelte
git commit -m "feat: add BabylonJS to nav"
```

---

### Task 3: Implement the BabylonJS page

**Files:**
- Modify: `src/routes/babylonjs/+page.svelte`

- [ ] **Step 1: Replace the file contents**

Replace `src/routes/babylonjs/+page.svelte` with:

```svelte
<script lang="ts">
	import { onMount } from 'svelte'
	import {
		Engine,
		Scene,
		ArcRotateCamera,
		HemisphericLight,
		MeshBuilder,
		StandardMaterial,
		Vector3,
		Color3,
	} from '@babylonjs/core'

	let canvas: HTMLCanvasElement | undefined

	onMount(() => {
		if (!canvas) return

		// Engine
		const engine = new Engine(canvas, true)
		engine.resize()

		// Scene
		const scene = new Scene(engine)

		// Camera
		const camera = new ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 3, 8, Vector3.Zero(), scene)
		camera.attachControl(false)

		// Light
		new HemisphericLight('light', Vector3.Up(), scene)

		// Box
		const box = MeshBuilder.CreateBox('box', { size: 1 }, scene)
		box.position.y = 1
		const boxMat = new StandardMaterial('boxMat', scene)
		boxMat.diffuseColor = new Color3(0.39, 0.58, 0.93)
		box.material = boxMat

		// Ground
		const ground = MeshBuilder.CreateGround('ground', { width: 6, height: 6 }, scene)
		const groundMat = new StandardMaterial('groundMat', scene)
		groundMat.diffuseColor = new Color3(0.5, 0.5, 0.5)
		ground.material = groundMat

		// Resize listener
		const resizeHandler = () => engine.resize()
		window.addEventListener('resize', resizeHandler)

		// Render loop
		engine.runRenderLoop(() => {
			box.rotation.y += 0.01
			scene.render()
		})

		return () => {
			window.removeEventListener('resize', resizeHandler)
			engine.stopRenderLoop()
			engine.dispose()
		}
	})
</script>

<svelte:head>
	<title>BabylonJS</title>
</svelte:head>

<div class="mockup-window border-base-300 relative w-full border bg-amber-400">
	<canvas class="aspect-video w-full" bind:this={canvas}></canvas>
</div>
```

- [ ] **Step 2: Run type check**

```bash
pnpm check
```

Expected: no errors.

- [ ] **Step 3: Start dev server and verify visually**

```bash
pnpm dev
```

Open `http://localhost:5173/babylonjs`. You should see:
- A cornflower-blue rotating cube above a gray ground plane
- An arc-rotate camera (drag to orbit, scroll to zoom)
- The page accessible from the `BabylonJS` nav link

- [ ] **Step 4: Commit**

```bash
git add src/routes/babylonjs/+page.svelte
git commit -m "feat: setup BabylonJS scene with rotating cube and ground plane"
```
