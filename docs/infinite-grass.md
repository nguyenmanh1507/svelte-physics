# How the grass is made

_Vietnamese version: [infinite-grass.vi.md](infinite-grass.vi.md)_

This explains the grass demo at `/games/infinite-grass`, ported from SimonDev's _Quick Grass_. The code lives in `src/lib/components/infinite-grass/`.

The core idea: **every blade of grass is built in the vertex shader**. The CPU never stores a single blade position. It uploads one small index buffer and asks the GPU to draw it 131,072 times, all in one draw call.

## The scene

The demo draws three objects:

| Object | File                            | What it is                                                                           |
| ------ | ------------------------------- | ------------------------------------------------------------------------------------ |
| Sky    | `sky.ts`, `shaders/sky.*`       | A sphere (radius 5,000 m) seen from inside, with a colour gradient.                  |
| Ground | `ground.ts`, `shaders/ground.*` | A 500 × 500 m plane with 512 × 512 segments, raised into hills in the vertex shader. |
| Grass  | `grass.ts`, `shaders/grass.*`   | 131,072 instanced blades scattered over a 100 × 100 m patch.                         |

`GrassScene` (`grass-scene.ts`) creates all three and keeps the uniforms they share (`shared-uniforms.ts`). The most important shared uniform is `terrainParams`: the ground and the grass read the same terrain function (`shaders/terrain.glsl`), so every blade is rooted exactly on the ground surface. The same function also exists on the CPU (`terrain.ts`), so regular three.js objects such as the player ball can be placed on the hills (see section 8).

## 1. A blade with no vertex data

`grass-geometry.ts` creates an `InstancedBufferGeometry` that has **no attributes at all**: no positions, normals or UVs. It only has:

- an **index buffer** describing the triangles of one blade, and
- `instanceCount` = the number of blades.

The vertex shader works out everything from two built-in counters:

- `gl_InstanceID`: which blade this is (0 … bladeCount − 1)
- `gl_VertexID`: which corner of the blade this is

### Blade layout

A blade is a strip split into `segments` pieces (6 by default). Each height level has two vertices, left and right, so one face has `(segments + 1) × 2` vertices:

```
 level 3   6 ── 7      even ID = left edge
           │ ╲  │      odd ID  = right edge
 level 2   4 ── 5
           │ ╲  │
 level 1   2 ── 3
           │ ╲  │
 level 0   0 ── 1      (root)
```

Each segment is two triangles: `(0, 1, 2)` and `(2, 1, 3)`, shifted up by 2 per level.

A blade has **two faces**. The back face uses vertex IDs `V … 2V − 1` (V = vertices per face) with the triangle winding reversed, so each side is front-facing for whoever is looking at it. That makes 12 indices per segment, 72 for a 6-segment blade.

Because the shape depends on `segments`, changing that slider is the only change that rebuilds geometry (`Grass.setParams`). Every other slider just writes a uniform.

## 2. Placing each blade

All of this is in `shaders/grass.vert`.

**Position.** `hash21(gl_InstanceID)` turns the instance number into two pseudo-random numbers in [0, 1). Remapped to [−1, 1] and multiplied by `patchSize`, they give the blade's x/z position. `terrainHeight()` then lifts it to the ground height at that point.

**Per-blade variation.** A second hash of the blade's world position gives three more random values:

- **Grass type:** about 1 blade in 8 becomes type 1, which uses the second texture and is 1.5× taller.
- **Facing angle:** a random rotation around the vertical axis.
- **Lean:** a random tilt between −0.5 and 0.5 radians.

Hashing the world position, not the instance ID, means a blade at the same spot always looks the same.

**Paths from a mask texture.** `tileData.jpg` is a black-and-white map stretched over the patch. White areas are paths. The blade height is multiplied by `1 − tileData`, so grass gets shorter towards a path. When the result falls below 0.25, the shader sets `gl_Position.w = 0`. That collapses every vertex of the blade to a degenerate point, so the GPU throws the whole blade away without drawing it.

## 3. Shaping the blade

**Decoding the vertex.** From `gl_VertexID` the shader works out:

- `xSide`: 0 for the left edge, 1 for the right
- `zSide`: −1 for the front face, +1 for the back
- `heightPercent`: 0 at the root, 1 at the tip

**Curving it with a Bézier curve.** A straight strip looks like paper. The blade instead follows a cubic Bézier curve with four control points:

```
P0 = (0, 0,    0)               root
P1 = (0, 0.33, 0)
P2 = (0, 0.66, 0)
P3 = (0, cos(lean), sin(lean))   tip, tilted by the lean angle
```

Evaluating the curve at `heightPercent` gives each vertex's height and forward bend. The curve's **derivative** (`bezierGrad`) is the direction along the blade. Rotating it 90° gives the surface normal, so lighting follows the curve.

**Rotating it into place.** The final orientation is `rotateAxis(trample) × rotateAxis(wind) × rotateY(facing angle)`, then the blade is moved to its position on the terrain. The trample rotation is explained in section 8.

## 4. Wind

Wind is two layers of noise, driven by `windTime`. The CPU accumulates it every frame as `delta × windSpeed`, so changing the speed slider never makes the grass jump.

1. **Gusts:** low-frequency noise over the ground (`xz × 0.05`) moving with time. It gives a wind strength that varies smoothly across the field, so neighbouring blades bend together like waves. The blade rotates around the wind axis by `strength × windStrength × heightPercent`, so the root stays put and the tip moves most.
2. **Flutter:** high-frequency noise per blade, running 4× faster, added to the lean angle. It is scaled by the gust strength, so blades flutter more where the wind is strong.

## 5. Two tricks that make it look right

**Rounder lighting far away.** Up close, the curved normals make the blades look 3D. Far away they turn into noisy shimmer. Between 0 and 10 m from the camera, the normal blends halfway towards straight up, so distant grass is lit like a smooth surface.

**Thickening edge-on blades.** A flat blade seen exactly from the side becomes a line one pixel wide and disappears. The shader measures how edge-on the blade is (the dot product of its face normal with the view direction). When it is nearly edge-on, it pushes the left and right vertices apart **in view space**. On screen the blade keeps some width from every angle, which makes the field look much fuller.

## 6. Colouring (`shaders/grass.frag`)

- **Texture:** the two blade images (`grass1.png`, `grass2.png`, 32 × 128) are packed into one `DataArrayTexture` (`textures.ts`). The shader samples it with UV = (`xSide`, `heightPercent`) and picks the layer by grass type.
- **Shape from alpha:** pixels with alpha below 0.5 are discarded. The geometry is a plain strip; the pointed blade outline comes from the texture.
- **Lighting:**
  - a hemisphere light: warm from above, dark blue from below, blended by the normal's y
  - a weak Phong specular highlight
- **Fake ambient occlusion:** colour is darkened towards the root (`heightPercent²` remapped to 0.125 … 1), imitating the shade deep inside dense grass.
- **Gamma:** the shader converts to sRGB itself with `pow(colour, 1/2.2)`. Textures are therefore loaded without colour-space conversion.

## 7. Ground and sky

**Ground.**

- The vertex shader moves each vertex of the dense plane with the same `terrainHeight()` as the grass roots.
- The fragment shader draws a "prototype" grid: a random brightness per 1 m cell, dark lines every 1 m, darker lines every 10 m, all from one grid texture sampled at two scales.

**Sky.** The colour comes from **screen position** (`gl_FragCoord / resolution`), not from view direction. It's a cheap stylised backdrop. The sky therefore doesn't move when the camera turns, and the `resolution` uniform must be updated on every resize.

## 8. Interactive grass: bending when something walks through

Blades bend away from a player or object moving through them, then slowly stand back up. Three pieces make this work.

### The trample map (`trample-map.ts`, `shaders/trample.frag`)

A 256 × 256 half-float texture is laid over the grass patch, about 0.4 m per texel. Each texel stores one 2D vector in its red and green channels:

- **direction:** which way the grass at that spot is pushed (on the ground plane)
- **length:** how strongly, from 0 (standing) to 1 (fully pressed)

Every frame a small fullscreen pass updates it, reading last frame's texture and writing a new one (two textures take turns):

1. **Fade:** the old vector is multiplied by `decay`. Bent grass slowly stands up again.
2. **Stamp:** for each interactor, texels within its radius are pushed away from its centre. Full strength inside half the radius, fading to 0 at the edge.

`decay = e^(−3·delta / recovery)`: after `recovery` seconds about 5% of the bend is left. It depends only on elapsed time, so the grass recovers at the same speed at 30 or 144 fps.

### Bending the blade (`shaders/grass.vert`)

The vertex shader reads the trample map once, at the blade's root. That's one texture read per vertex, no matter how many objects there are. From the vector it gets:

- **amount** = its length
- **direction** = it, normalised

It then adds one more rotation in front of the wind: around the horizontal axis perpendicular to the push direction, by `amount × trampleBend × heightPercent`. Like wind, the root stays put and the tip bends most, so the blade curves instead of tipping over like a stick.

Pressed grass also gets less wind (`windLean × (1 − amount)`). Otherwise flattened grass would still wave around.

One detail: the `rotateAxis` helper builds its matrix in the transposed order, so it actually rotates by **minus** the angle. The trample axis is flipped to make up for it; there is a comment next to it in the shader.

### Interactors and the player (`player.ts`, `player-input.ts`, `grass-scene.ts`)

Anything with a `position` and a `trampleRadius` (the `Interactor` interface) can press the grass. Register it with `world.addInteractor(obj)`. Up to 8 at once (`MAX_INTERACTORS`).

The demo's interactor is `PlayerBall`, an orange ball that:

- moves with **W A S D** / arrow keys relative to the camera (`moveDirection`), Shift to run
- rolls without slipping
- sits on the ground using `GrassScene.heightAt(x, z)`
- has the camera follow it

Turn on **"Tự đi vòng tròn"** (auto walk) in the panel and the ball walks in a circle whenever no key is held.

### Why the terrain noise changed

To put the ball on the hills, the CPU has to compute exactly the same height as the GPU. The original noise used a `sin()`-based hash, which gives different results in GLSL (float32, GPU-specific `sin`) and in JavaScript.

The lattice hash in `noise.glsl` is now `latticeGradient`, a pcg3d integer hash. Integer multiply and XOR give identical results on both sides, so `terrain.ts` reproduces the terrain to within about a micrometre. The hills (and the wind pattern, which uses the same noise) therefore look different from the original demo. Per-blade randomness still uses the old `sin` hash, because the CPU never needs it.

## Where to change things

| To change…                                | Edit                                                                              |
| ----------------------------------------- | --------------------------------------------------------------------------------- |
| Default blade count, size, terrain, wind  | `params.ts` (`defaultGrassParams`)                                                |
| Panel sliders and their ranges            | `src/routes/games/infinite-grass/components/controls.ts`                          |
| Hill shape                                | `shaders/terrain.glsl`: used by both ground and grass, so they stay in sync       |
| Blade shape, bend, wind                   | `shaders/grass.vert`                                                              |
| Blade colour and lighting                 | `shaders/grass.frag`, `textures/grass*.png`                                       |
| Paths                                     | `textures/tileData.jpg` (white = path)                                            |
| Add a new object                          | New class like `Sky`/`Ground` that takes `SharedUniforms`; add it in `GrassScene` |
| How grass reacts to being pressed         | `trampleRadius` / `trampleBend` / `trampleRecovery` in `params.ts`                |
| Footprint shape (falloff, push direction) | `shaders/trample.frag`                                                            |
| Make another object press the grass       | Give it `position` + `trampleRadius`, call `world.addInteractor(obj)`             |
| Player speed, camera offset, auto walk    | Constants at the top of `grass-view.svelte`                                       |

## Limitations

- **Not infinite yet.** The grass is a fixed patch around the origin and the ground is 500 m wide. A truly infinite field would place blades on a world-space grid around the camera, so they stay still as the camera moves. It would also need ground that follows the camera.
- **Constant density.** More blades or a smaller patch means denser grass. There is no level of detail: distant blades cost as much as near ones.
- **Single light.** The light direction and colours are constants in `grass.frag`.
- **Trampling only covers the grass patch.** The trample map is centred on the patch, so it would need to follow the camera along with the grass for an infinite field.
- **Interactor height is ignored.** Only x and z are stamped, so something flying above the grass would still flatten it. Up to 8 interactors at once.
