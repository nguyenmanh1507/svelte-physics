# svelte-physics

<video src="static/volumetric-cloudscapes.mp4" controls muted loop width="100%">
  <a href="static/volumetric-cloudscapes.mp4">Watch the volumetric cloudscapes demo</a>
</video>

_Demo: a Nubis-style volumetric cloudscape over a low-poly city, rendered in real time with Three.js._

## Purpose

This is a personal playground for **experimenting with technology** — physics, real-time graphics and game programming on the web. It is not a product or a library; each route is a small, self-contained experiment used to learn how something works by building it.

Everything runs in the browser on [SvelteKit](https://svelte.dev/docs/kit) (Svelte 5).

## What's inside

| Area               | Route                                                     | What it explores                                                                                        |
| ------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Volumetric clouds  | `/games/volumetric-cloud`, `/games/city-volumetric-cloud` | Ray-marched volumetric clouds, a port of Nubis cloudscape into Three.js, cloud shadows, post-processing |
| Jolt Physics       | `/jolt-physics`                                           | Jolt rigid-body physics with Threlte, arcade car and plane controllers                                  |
| Threlte            | `/threlte`                                                | Three.js in Svelte: introduction, gemstone, post-processing                                             |
| Ten Minute Physics | `/ten-min-physics`                                        | 2D/3D physics, billiards and pinball following the Ten Minute Physics series                            |
| JS physics         | `/js-physics`                                             | Bouncing ball with p5.js                                                                                |
| Babylon.js         | `/babylonjs`                                              | Basic Babylon.js scene setup                                                                            |
| Games              | `/games`                                                  | Small game prototypes (LittleJS breakout, match-3, state pattern)                                       |
| Watercolor         | `/watercolor`                                             | Watercolor brush clone                                                                                  |

## Tech stack

- [SvelteKit](https://svelte.dev/docs/kit) + Svelte 5, Tailwind CSS 4, daisyUI
- [Three.js](https://threejs.org), [Threlte](https://threlte.xyz), [postprocessing](https://github.com/pmndrs/postprocessing)
- [Babylon.js](https://www.babylonjs.com)
- [Jolt Physics](https://github.com/jrouwe/JoltPhysics.js)
- [p5.js](https://p5js.org), [LittleJS](https://github.com/KilledByAPixel/LittleJS), [Kaplay](https://kaplayjs.com)
- Storybook, Vitest and Playwright for UI examples and tests

## Getting started

Requires Node.js `>=24` and [pnpm](https://pnpm.io).

```sh
pnpm install
pnpm dev
```

Then open the URL printed by Vite.

## Scripts

| Command          | Description                        |
| ---------------- | ---------------------------------- |
| `pnpm dev`       | Run the Vite dev server            |
| `pnpm build`     | Build the production bundle        |
| `pnpm preview`   | Serve the production build locally |
| `pnpm lint`      | Run Prettier check and ESLint      |
| `pnpm format`    | Auto-format with Prettier          |
| `pnpm test:unit` | Run Vitest unit tests              |
| `pnpm test:e2e`  | Run Playwright end-to-end tests    |
| `pnpm test`      | Run unit tests, then e2e tests     |
| `pnpm storybook` | Run Storybook at `localhost:6006`  |
