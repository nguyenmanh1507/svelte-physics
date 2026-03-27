# BabylonJS Setup for SvelteKit — Design Spec

**Date:** 2026-03-27

## Overview

Add a BabylonJS basic scene to the existing `src/routes/babylonjs/+page.svelte` stub. The scene shows a rotating cube above a ground plane with an arc-rotate camera and a hemispheric light, using the tree-shakeable `@babylonjs/core` ES6 package.

## Package

Install `@babylonjs/core` as a production dependency:

```bash
pnpm add @babylonjs/core
```

No other BabylonJS packages are needed for this scope.

## File Changes

Two files are modified:

1. `src/routes/babylonjs/+page.svelte` — main implementation
2. `src/lib/components/page-header.svelte` — add BabylonJS nav entry (see Nav section)

## Nav Registration

The project uses a manually maintained `menuItems` array in `src/lib/components/page-header.svelte`. Add a top-level entry:

```ts
{ label: 'BabylonJS', href: '/babylonjs' }
```

## Imports

The script block must use `lang="ts"`. Required imports:

```ts
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
```

## Structure

- `<script lang="ts">` block (required — all other pages use TypeScript)
- Preserve the existing `<svelte:head><title>BabylonJS</title></svelte:head>` block from the stub
- Declare the canvas variable with an undefined-compatible type: `let canvas: HTMLCanvasElement | undefined`
- Bind the canvas: `<canvas bind:this={canvas}>`
- Complete `onMount` body in order:

```ts
onMount(() => {
  if (!canvas) return

  // 1. Engine
  const engine = new Engine(canvas, true) // true = antialias
  engine.resize() // sync render buffer to CSS-sized canvas immediately

  // 2. Scene
  const scene = new Scene(engine)

  // 3. Camera
  const camera = new ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 3, 8, Vector3.Zero(), scene)
  camera.attachControl(false) // false = keep preventDefault on pointer events; no canvas arg in v6+

  // 4. Light
  new HemisphericLight('light', Vector3.Up(), scene)

  // 5. Box
  const box = MeshBuilder.CreateBox('box', { size: 1 }, scene)
  box.position.y = 1
  const boxMat = new StandardMaterial('boxMat', scene)
  boxMat.diffuseColor = new Color3(0.39, 0.58, 0.93) // cornflower blue
  box.material = boxMat

  // 6. Ground
  const ground = MeshBuilder.CreateGround('ground', { width: 6, height: 6 }, scene)
  const groundMat = new StandardMaterial('groundMat', scene)
  groundMat.diffuseColor = new Color3(0.5, 0.5, 0.5) // neutral gray
  ground.material = groundMat

  // 7. Resize listener (must be declared before cleanup return)
  const resizeHandler = () => engine.resize()
  window.addEventListener('resize', resizeHandler)

  // 8. Render loop
  engine.runRenderLoop(() => {
    box.rotation.y += 0.01 // fixed delta — acceptable for a demo
    scene.render()
  })

  // 9. Cleanup
  return () => {
    window.removeEventListener('resize', resizeHandler)
    engine.stopRenderLoop()
    engine.dispose()
  }
})
```

## Canvas Sizing Note

The canvas has `aspect-video w-full` CSS classes, which set the display size. The backing pixel buffer defaults to 300×150 until `engine.resize()` is called. Calling `engine.resize()` immediately after `new Engine(canvas, true)` syncs the buffer to the display size. BabylonJS then manages the canvas `width`/`height` attributes from that point on.

## Styling

The canvas is wrapped in the same DaisyUI `mockup-window` pattern used in other pages:

```html
<div class="mockup-window border-base-300 relative w-full border bg-amber-400">
  <canvas class="aspect-video w-full" bind:this={canvas}></canvas>
</div>
```

## Out of Scope

- Physics (Havok/Ammo.js)
- Shadows
- Multiple scenes
- Reusable `<BabylonCanvas>` wrapper component
- Frame-rate independent animation
