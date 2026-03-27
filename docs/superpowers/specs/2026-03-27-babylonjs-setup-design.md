# BabylonJS Setup for SvelteKit — Design Spec

**Date:** 2026-03-27

## Overview

Add a BabylonJS basic scene to the existing `src/routes/babylonjs/+page.svelte` stub. The scene shows a rotating cube above a ground plane with an arc-rotate camera and a hemispheric light, using the tree-shakeable `@babylonjs/core` ES6 package.

## Package

- Install `@babylonjs/core` as a production dependency via pnpm.
- No other BabylonJS packages needed for this scope.

## File Changes

Only one file is modified: `src/routes/babylonjs/+page.svelte`. No new files are created.

## Structure

- A `<canvas>` element bound with `bind:this={canvas}` is passed directly to the BabylonJS `Engine` constructor.
- Engine and scene are created inside `onMount`. The cleanup function returned from `onMount` calls `engine.dispose()`.
- A `window.addEventListener('resize', () => engine.resize())` listener is registered inside `onMount` and removed on cleanup.

## Scene Contents

| Element | Details |
|---|---|
| `ArcRotateCamera` | Orbits the origin; pointer/touch controls attached to canvas |
| `HemisphericLight` | Direction `Vector3.Up()`; soft ambient fill |
| Box mesh | `MeshBuilder.CreateBox`, positioned at `y = 1`, cornflower blue `StandardMaterial` |
| Ground mesh | `MeshBuilder.CreateGround`, 6×6 units at `y = 0`, neutral gray `StandardMaterial` |
| Render loop | `engine.runRenderLoop(() => scene.render())` with `box.rotation.y += 0.01` per frame |

## Styling

The canvas is wrapped in the same DaisyUI `mockup-window` pattern used in other pages:

```html
<div class="mockup-window border-base-300 relative w-full border bg-amber-400">
  <canvas class="aspect-video w-full" bind:this={canvas}></canvas>
</div>
```

## Cleanup

- `engine.dispose()` — stops the render loop and releases WebGL resources
- `window.removeEventListener('resize', resizeHandler)` — prevents stale listener

## Out of Scope

- Physics (Havok/Ammo.js)
- Shadows
- Multiple scenes
- Reusable `<BabylonCanvas>` wrapper component
