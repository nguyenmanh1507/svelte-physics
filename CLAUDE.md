# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this repo is

A personal playground for graphics/physics/game experiments on SvelteKit (Svelte 5 runes, Tailwind 4, daisyUI). Each route under `src/routes` is a self-contained experiment, not a product. Code comments and UI strings are mostly in Vietnamese; match that when editing nearby code.

## Commands

AGENTS.md lists the standard scripts. Additional ones you will need:

- Type-check: `pnpm check` (svelte-kit sync + svelte-check)
- Single unit test file: `pnpm vitest --run src/lib/components/nubis-cloud/params.spec.ts`
- Single test by name: `pnpm vitest --run -t "<name>"`
- Single e2e file: `pnpm playwright test e2e/routes.test.ts` (the Playwright `webServer` runs a full `pnpm build && pnpm preview` first, so it is slow)

Vitest has two projects (`vite.config.ts`): `server` (Node) runs every `src/**/*.spec.ts` _except_ `*.svelte.spec.ts`; `client` runs `*.svelte.spec.ts` in headless Chromium via `@vitest/browser-playwright` (needs Playwright browsers installed). Tests must contain at least one assertion (`requireAssertions`).

## Architecture

**Routing / build.** `+layout.ts` sets `prerender = true` and the adapter is `adapter-static` (output in `build/`, `strict: true`), so every route must be prerenderable. Routes that touch WebGPU/WebGL/canvas/Jolt WASM at import time opt out with `export const ssr = false` in a sibling `+page.ts` (see `babylonjs`, `watercolor`, `jolt-physics/test`). Navigation lives in a hard-coded list in `src/lib/components/page-header.svelte`, and `e2e/routes.test.ts` has a hard-coded route list — update both when adding a route.

**Imports.** `#lib` / `#lib/*` (package.json `imports`) map to `src/lib`; use these rather than `$lib`. `src/lib/components/ui/*` is shadcn-svelte style (bits-ui + tailwind-variants, see `components.json`).

**Two independent volumetric-cloud implementations** (don't conflate them):

- `src/lib/components/volumetric-cloud/` — older WebGL/GLSL teaching demo: `shaders/step1..5.frag` are progressive stages of one ray-marcher, concatenated with `common.glsl` (and `noise.glsl` for step 5) via `?raw` imports and swapped at runtime in `volumetric-cloud.svelte`. Used by `/games/volumetric-cloud`.
- `src/lib/components/nubis-cloud/` — the main one: Nubis-style clouds on Three.js **WebGPURenderer** (`three/webgpu`, TSL + WGSL via `wgslFn`). Used by `/games/city-volumetric-cloud`.
  - `NubisCloudscape` (`nubis-cloudscape.ts`) owns the multi-pass pipeline: scene → HDR render target with depth → cloud march at reduced `renderScale` → composite (sky, cloud shadows, aerial perspective) → optional stylized post (outline, bloom, grading) → screen. It replaces `renderer.render(scene, camera)` with `clouds.render(scene, camera, delta)`. The camera must be a `PerspectiveCamera` with standard (non-reversed, non-logarithmic) depth because shaders reconstruct distance from near/far.
  - `NubisPass` is the extension point for extra passes drawn additively into the HDR image; `NubisLightShafts` (`light-shafts.ts`) implements it and is created/disposed by `nubis-sky.svelte` from its `lightShafts` prop.
  - `NubisSky` (`nubis-sky.svelte`) is the Svelte wrapper: it creates the renderer, cloudscape and render loop, and takes a `setup(ctx)` callback returning `{ update, resize, dispose }` hooks. Reactive `params` are pushed in via `$state.snapshot` → `setParams`.
  - `params.ts` is the single source of truth for tunables (`NubisParams`, defaults, presets). `packUniforms` packs them into `vec4` uniforms shared by the cloud and composite passes; keep those packing slots in sync with the WGSL signatures in `wgsl/*.ts`. All lengths are in "Nubis metres" and multiplied by `scale`, so a small scene (300-unit city) still gets realistically sized clouds. Params in `WEATHER_KEYS` require regenerating the weather map via compute shader; others only update uniforms.
  - Noise volumes (shape 128³, detail 32³, curl, weather) are generated on the GPU by compute shaders in `noise-textures.ts`.
  - `docs/nubis-webgpu/` is the original standalone, bundler-free JS prototype this was ported from; `volumetric-clouds.html` in the repo root is an untracked standalone scratch file.
- Project docs, designs and plans are in `docs/` (`docs/plans`, `docs/superpowers/{specs,plans}`).

**Jolt physics (`src/lib/hooks/use-jolt/`).** A Threlte-integrated wrapper around `jolt-physics/wasm-compat`: `JoltWorld.svelte` initializes the WASM module once (`getJoltModule` memoizes the promise in `world.ts`), provides context, and steps the simulation from a Threlte task (`JOLT_WORLD_STEP_TASK_KEY`); `JoltRigidBody.svelte` / `useRigidBody` register bodies and sync transforms using the `convert.ts` Jolt⇄Three helpers. Only two object layers exist (`LAYER_MOVING` / `LAYER_NON_MOVING`, `constants.ts`). Game logic that should be unit-tested is kept as plain TS next to the scene (e.g. `arcade-plane-controller/components/plane-controller.ts` + `.spec.ts`).

**Pattern for testable logic.** Pure data/geometry logic is split out of `.svelte` files into `.ts` modules with `.spec.ts` siblings (`building-map`, `road-map`, `shapes`, `params`, `light-shafts`), while rendering stays in the components.

## Gotchas

- `svelte-tweakpane-ui` is patched via pnpm (`patches/`, `pnpm-workspace.yaml`); don't remove the patch when upgrading without checking it still applies.
- `vite.config.ts` deliberately filters two noisy warnings (Jolt's `node:module` externalization, Threlte unused imports); don't treat their absence as a bug.
- `pnpm build` runs Vite with `--max-old-space-size=8192`; use that script rather than calling `vite build` directly.
- `build/`, `storybook-static/`, `test-results/` and `.cursor/debug.log` are artifacts, not source.
