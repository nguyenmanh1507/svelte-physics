# Camera Logger Component Design

**Date:** 2026-02-21

## Goal

A dev-tool component that displays live camera properties as a floating HUD overlay, with a copy button to generate a ready-to-paste `<T.PerspectiveCamera />` snippet.

## Architecture

- **File:** `src/lib/components/camera-logger/camera-logger.svelte`
- **Export:** `src/lib/components/camera-logger/index.ts`
- Placed outside `<Canvas>`, same pattern as `<Stats />`
- Uses `useThrelte()` + `useTask()` to read `camera.current` every frame

## Properties Displayed

- `position` (x, y, z)
- `rotation` Euler (x, y, z) in radians
- `fov`, `near`, `far`

## UI

- Fixed overlay, bottom-right corner
- Updates every frame
- Numbers rounded to 2 decimal places
- Copy button writes a `<T.PerspectiveCamera ... />` snippet to clipboard

## Output Format (clipboard)

```html
<T.PerspectiveCamera
	position="{[0,"
	15,
	30]}
	rotation="{[-0.46,"
	0,
	0]}
	fov="{75}"
	near="{0.1}"
	far="{1000}"
	makeDefault
/>
```

## Usage

```svelte
<Scene />
<CameraLogger />
```
