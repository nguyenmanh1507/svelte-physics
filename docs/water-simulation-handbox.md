# Water Simulation Handbook for Games and Web 3D

A reference compiled from the demos in the **Game Prototype** project (Pool Water Lab, Shoaling Beach Lab, Ao Sen, Dam Break Valley, Golden Cove MPM, Lighthouse Isle), the book _Fluid Simulation for Computer Graphics_ (Bridson, 2nd ed.) and common game techniques. The goal: next time you build water, open this file to choose an approach, and you'll find ready-made formulas, starting parameters and a list of mistakes to avoid.

Every formula comes with a plain-language explanation. You don't need to memorise the maths: just know what each quantity means and which knob produces which effect.

---

## Contents

1. [Which method should you pick?](#1-which-method-should-you-pick)
2. [Minimum background](#2-minimum-background)
3. [Group A: Precomputed surfaces (no simulation)](#3-group-a-precomputed-surfaces-no-simulation)
4. [Group B: 2D heightfield, wave equation](#4-group-b-2d-heightfield-wave-equation)
5. [Group C: 2D heightfield, shallow water](#5-group-c-2d-heightfield-shallow-water)
6. [Group D: 3D grids (Eulerian)](#6-group-d-3d-grids-eulerian)
7. [Group E: 3D particles (SPH, PBF, FLIP, MPM)](#7-group-e-3d-particles-sph-pbf-flip-mpm)
8. [Rendering water](#8-rendering-water)
9. [Interaction with objects](#9-interaction-with-objects)
10. [Platforms and performance](#10-platforms-and-performance)
11. [Bugs we hit](#11-bugs-we-hit)
12. [Ready-made recipes for game scenarios](#12-ready-made-recipes-for-game-scenarios)
13. [References](#13-references)

---

## 1. Which method should you pick?

The key question isn't "how do I simulate it correctly" but **what does the water in this game need to do**.

| Group                                         | How it works                                   | Can do                                                     | Can't do                                               | Cost                          | Demo in this project                 |
| --------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------ | ----------------------------- | ------------------------------------ |
| **A. Precomputed** (sine sums, Gerstner, FFT) | Height = a function of (x, z, t)               | Endless oceans, good-looking waves, cheap                  | Doesn't react to objects, isn't blocked by islands     | Very cheap                    | Lighthouse Isle                      |
| **B. Wave equation**                          | 2D grid stores height, waves propagate         | Ripples from a thrown stone, waves reflecting off walls    | Water doesn't flow anywhere, can't spill onto dry land | Cheap (GPU ping-pong)         | Pool Water Lab, Ao Sen               |
| **C. Shallow water (SWE)**                    | 2D grid stores depth + velocity                | Floods, dam breaks, run-up on beaches, flow around objects | Curling waves, splashes, waterfalls                    | Medium                        | Shoaling Beach Lab, Dam Break Valley |
| **D. 3D grid**                                | 3D grid of velocity + pressure                 | Smoke, fire, water in closed tanks (with level sets)       | Hard to make good free-surface water in real time      | Expensive                     | Flame Lab                            |
| **E. 3D particles** (SPH, PBF, MPM)           | Tens of thousands of particles carry the water | Breaking waves, splashes, pouring, waterfalls              | Large bodies of water (particle budget)                | Expensive (needs GPU compute) | Golden Cove MPM                      |

**Quick rules:**

- Sea or large lake as a backdrop → **A**.
- Small water surface that must ripple when touched (pond, pool, puddle) → **B**, usually layered on **A** for background waves.
- Water that must **flow** (floods, tide on a beach, dam break, canals) → **C**.
- A "showcase" shot: pouring a glass, waves hitting rocks, a small waterfall → **E**, inside a small box.
- Games usually **combine** them: A for the far sea, B or C around the player, E for local effects, and decorative particles (spray, foam) to hide the seams.

One more principle: **most of water's beauty comes from rendering, not simulation**. Lighthouse Isle simulates nothing yet still looks alive, thanks to depth-based colour, edge foam and spray. Invest in rendering (section 8) before upgrading the simulation.

---

## 2. Minimum background

### 2.1 The Navier–Stokes equations, in words

Every method is an approximate solution of these two laws (Bridson ch.1):

1. **Momentum:** a water parcel's acceleration = gravity + push from pressure differences + internal friction (viscosity).

   ```
   ∂u/∂t + (u·∇)u = −(1/ρ)∇p + g + ν∇²u
   ```
   - `(u·∇)u` is **advection**: the water carries its own velocity along.
   - `−∇p/ρ`: water is pushed from high pressure toward low pressure.
   - `ν∇²u`: viscosity. For water it can usually be dropped (Bridson §1.5); the solver's numerical error is already "viscous" enough.

2. **Incompressibility:** what flows into a cell equals what flows out.
   ```
   ∇·u = 0
   ```

### 2.2 Two viewpoints

- **Eulerian (grid):** stand still and measure the water flowing past. Examples: the 2D SWE grid, the 3D smoke grid.
- **Lagrangian (particles):** follow each parcel of water. Examples: SPH, PBF.
- **Hybrid:** FLIP, APIC and MPM use particles to _carry_ the water and a grid to _compute forces_. This is the strongest approach today (MPM in Golden Cove).

### 2.3 Splitting

Instead of solving the whole equation at once, split each time step into sub-steps (Bridson ch.2):

```
1. advect   – move quantities along the flow
2. forces   – add gravity, wind, pushing objects
3. project  – fix the velocity so it's incompressible (pressure solve)
```

### 2.4 Time step and CFL

**Golden rule:** within one step, nothing may travel further than one grid cell.

```
Δt ≤ C · Δx / v_max        (C ≈ 0.2–1)
```

- For waves, `v_max` is the **wave speed**, not the water speed. Shallow water: `c = √(g·d)`.
- For compressible particles (SPH, MPM), `v_max` is the **artificial speed of sound** `c_s`, usually the largest.
- Blow-ups (NaN, values shooting to infinity) are almost always CFL violations. Fix them with substeps rather than a smaller global Δt.

Numbers actually used:

| Demo                   | Δx         | Δt formula                                         |
| ---------------------- | ---------- | -------------------------------------------------- |
| Pool Water Lab (waves) | 1 texel    | substeps such that `c·Δt/Δx ≤ 0.5`                 |
| Dam Break Valley (SWE) | 0.05 m     | `0.2·Δx/√(g·max(d))`, at most 12 steps per frame   |
| Golden Cove (MPM)      | 0.2–0.33 m | `(1/60)/substeps`, 5–7 substeps, `c_s·Δt ≈ 0.33Δx` |

### 2.5 Dispersion: why long waves travel faster

The relation between frequency `ω` and wavenumber `k = 2π/L`:

```
ω² = g·k·tanh(k·d)
```

- **Deep water** (large d): `ω = √(g·k)`, speed `c = √(g/k)`. Long waves outrun short ones.
- **Shallow water** (small d): `c = √(g·d)`. All waves move at the same speed and slow down near the shore. That's why waves **pile up and break** in the shallows (shoaling).

This is the most useful formula to remember. Use it for precomputed waves (section 3), to sanity-check simulations, and to solve `k` from the period `T` for a piston wavemaker (section 9).

---

## 3. Group A: Precomputed surfaces (no simulation)

### 3.1 Sum of sines

```
y(x, z, t) = Σ Aᵢ · sin(kᵢ (dᵢ·p) − ωᵢ t + φᵢ)
```

Simple, but crests are as round as troughs, so it looks "soft".

### 3.2 Gerstner (trochoidal) waves

Each point moves **horizontally** as well as **vertically**, so crests are sharp and troughs are flat, which is the right shape for ocean waves:

```
f = k (d · p − c t),     k = 2π/L,   c = √(g/k)
x += Q·A·dₓ·cos f
z += Q·A·d_z·cos f
y += A·sin f
```

| Parameter | Meaning                             | Suggestion                                                                                |
| --------- | ----------------------------------- | ----------------------------------------------------------------------------------------- |
| `L`       | Wavelength                          | Main wave 20–40 m, secondary waves 5–15 m                                                 |
| `A`       | Amplitude                           | Keep `A/L` < 1/7                                                                          |
| `Q`       | Steepness, 0 = sine, 1 = very sharp | 0.3–0.6. The sum of `Qᵢ·kᵢ·Aᵢ` must be < 1, otherwise the surface self-intersects (loops) |
| `d`       | Direction                           | Spread ±0.5–1.2 rad around the wind direction                                             |

The 4-wave set used in Lighthouse Isle (angle offset from wind, L, Q, A):

```js
;[
	[0.0, 30, 0.55, 0.85],
	[0.5, 17, 0.5, 0.45],
	[-0.6, 11, 0.45, 0.28],
	[1.25, 6.5, 0.3, 0.12],
]
```

**Analytic normals:** add each wave's derivative to two tangent vectors, then take the cross product. Full code is in `lighthouse-isle-tutorial.md`, section 7.

**Tips:**

- Write **the same function** in GLSL (for drawing) and JS (for floating objects, spray, collisions). Both must share parameters and the same clock.
- In a box or bounded area, **turn off horizontal displacement near the edges** (`edge = smoothstep(...)`), or the mesh edges get dragged out of place.
- For a "big wave" event, add a travelling Gaussian bump: `A·exp(−((d·p − x₀ − v·t)/W)²)`.

### 3.3 FFT ocean (Tessendorf)

This is how films and AAA games do the sea (Bridson ch.13):

1. Generate a random wave spectrum `h₀(k)` from a statistical spectrum (Phillips, JONSWAP) driven by wind speed.
2. Every frame, rotate each component's phase: `h(k, t) = h₀(k)·e^{iωt} + conj(h₀(−k))·e^{−iωt}`, with `ω = √(g|k|)`.
3. Inverse FFT to a height grid (typically 256²) that tiles seamlessly.
4. Add horizontal displacement ("choppiness") via the FFT of `−i·k/|k|·h`.

Pros: thousands of waves at fixed cost. Cons: visible repetition at a distance. Fix by layering 2–3 FFT tiles of different sizes (Bridson §13.6). On the web: ping-pong FFT in fragment shaders (WebGL2) or compute shaders (WebGPU).

---

## 4. Group B: 2D heightfield, wave equation

### 4.1 The equation

Bridson §12.2:

```
∂²h/∂t² = c² ∇²h,      c² = g·d
```

In plain words: **the surface is pulled toward the average of its neighbouring cells**. A cell higher than its neighbours gets pulled down; a lower one gets pushed up. That's how waves spread.

### 4.2 Discrete code (Verlet, 2 buffers)

```glsl
// each texel: (h_current, h_previous)
float lap = hL + hR + hD + hU - 4.0*h;            // Laplacian = "difference from neighbours"
float hNew = 2.0*h - hPrev + (c*c*dt*dt/(dx*dx)) * lap;
hNew *= damping;                                   // 0.995–0.999: waves fade out
```

- **Stability condition:** `c·Δt/Δx ≤ 1/√2` (2D). Use ≤ 0.5 to be safe.
- **Dropping a stone:** add a negative Gaussian bump to `h` (`addDrop`).
- **Tank walls:** set `h` outside the boundary equal to the cell inside (waves reflect), or damp it in a strip near the boundary (waves leave).
- **Obstacles:** pin `h = 0` in cells inside the object, and waves bend around it (diffraction).

### 4.3 Running on the GPU (WebGL)

Ping-pong two float render targets (`HalfFloatType` is enough). Each step draws a fullscreen quad that reads RT A, writes RT B, then swaps. A 256² grid with several substeps per frame stays light (Pool Water Lab).

### 4.4 Practical tips

- **Effective depth:** for a small pond, the real `d` makes waves move too fast. Ao Sen uses `C² = 9.81·depth·0.18` so ripples move at a pond-like speed.
- **Per-cell speed:** let `c²` vary per cell (`c² = g·d(x,z)`) and waves slow down in the shallows on their own. It's still a linear wave, though: no breaking, no run-up.
- **Combine with group A:** add Gerstner as the background swell; the grid only handles interaction ripples.

---

## 5. Group C: 2D heightfield, shallow water

### 5.1 When you need it

When the water must **actually move**: a flood pouring into a valley, water running up a beach and draining back, water flowing around a bridge pier. The wave equation can't do this because it has no notion of "a dry cell becoming wet" (switch Dam Break Valley to its §12.2 mode: the dam breaks and the water stays put).

### 5.2 Quantities on a MAC (staggered) grid

Bridson §12.3:

| Quantity    | Location              | Meaning                 |
| ----------- | --------------------- | ----------------------- |
| `d`         | cell centre           | Water depth             |
| `b`         | cell centre           | Bed elevation (terrain) |
| `h = b + d` | cell centre           | Water surface elevation |
| `u`         | left/right cell faces | Velocity along x        |
| `w`         | front/back cell faces | Velocity along z        |

Putting velocities on cell faces (staggered grid) makes pressure gradients and divergence more accurate and avoids "checkerboard" oscillation.

### 5.3 One step

```
1. Advect u, w, d (semi-Lagrangian: trace back along the velocity, interpolate)
2. h = b + d; extrapolate h into dry cells
3. u -= Δt · g · (h[i] − h[i−1]) / Δx        (likewise for w)
4. d -= Δt · d · (∇·u)
5. Bed friction: u *= 1 / (1 + Δt · C_f · |u| / d)
```

Δt: `0.2 · Δx / √(g · d_max)`.

### 5.4 Wet and dry

This is the hardest part of SWE:

- Wet threshold: a cell counts as wet only if `d > ε` (ε ≈ 4e-4 m).
- **Extrapolate `h`, not `d`**, into dry cells (Bridson). That keeps water resting on a slope from drifting on its own.
- **A bug we hit:** following the book exactly, water standing next to a _lower_ dry cell never spills into it (the dam breaks and the water doesn't move). **Fix:** if a dry cell's bed is lower than the neighbouring water surface, use its own `h = b` so the water can flow; if it's higher, keep the extrapolated value.
- Clamp velocity (±6 m/s) to stop blow-ups at the thin water front.

### 5.5 Boundary conditions

Bridson §12.1.4:

- **Wall:** velocity normal to the wall = 0; waves reflect.
- **Open boundary:** copy the velocity from the inner cell outward (`u[edge] = max(0, u[edge−1])`), plus a **sponge layer** of about 14 cells to calm waves before they leave.
- **Wavemaker:** a piston pushes (set `u` at the edge to the piston velocity), see 9.3.

### 5.6 Validate against an analytic solution

The dam break on a dry bed (Ritter) is the standard SWE test:

```
c₀ = √(g·h₀)
h(x, t) = (2c₀ − ξ)² / (9g)   for  −c₀ ≤ ξ = (x − x_dam)/t ≤ 2c₀
depth right at the dam = 4h₀/9;   the flood front moves at 2c₀
```

Dam Break Valley compares the depth at the dam against `4h₀/9` (within about 10%). The simulated front lags the theory because of friction and because the grid can't represent the infinitely thin tip.

### 5.7 Built-in limitation

Each (x, z) point has **one** height. So SWE can't curl waves, splash, or make waterfalls. Hide this with decorative particles: spawn foam where velocity or surface slope is large.

---

## 6. Group D: 3D grids (Eulerian)

Mostly used for **smoke and fire**. For free-surface water you also need a level set or marker particles.

### 6.1 The standard loop ("Stable Fluids")

```
1. advect velocity and quantities (temperature T, smoke s, fuel...)  – semi-Lagrangian
2. forces: buoyancy  f_y = −α·s + β·(T − T_ambient)
           vorticity confinement (restores small swirls lost to numerical error)
3. divergence: div = ∇·u
4. solve pressure ∇²p = div/Δt   (20–40 Jacobi iterations, or PCG/multigrid)
5. subtract the gradient: u −= Δt·∇p
```

Bridson ch.3 (advection), ch.5 (pressure), ch.6 (smoke), ch.11 (vorticity).

### 6.2 Semi-Lagrangian advection

"The new value in this cell = the old value at the place the fluid came from":

```glsl
vec3 back = pos - dt * velocity(pos);   // trace back
q_new = sample_trilinear(q_old, back);
```

Always stable but blurs detail. Improve with MacCormack/BFECC, cubic interpolation, or move to particles (FLIP, APIC).

### 6.3 Fire (Bridson ch.9)

- **Thin flames:** a level set `φ` advances at burn speed `S`; gas expands across the flame front.
- **Volumetric combustion:** fuel `F` burns when `T > T_ignition`. The burned amount `ΔF = min(F, z·Δt)` produces heat, smoke and volume expansion (positive divergence).
- Radiative cooling: `dT/dt = −c·((T − Ta)/(Tm − Ta))⁴`.
- Colour: black-body by temperature, a blue core in the reaction zone.

### 6.4 On the web

Store the 3D grid as a **2D atlas** (z slices tiled side by side in one texture). Each step is a fullscreen pass. Flame Lab uses 48×80×48 with 28 Jacobi iterations and renders by ray-marching through the atlas.

Free-surface water would also need a level set, distance reinitialisation, velocity extrapolation and more. In real time, particles (group E) are usually easier.

---

## 7. Group E: 3D particles (SPH, PBF, FLIP, MPM)

### 7.1 Quick comparison

| Method                          | Idea                                                                 | Pros                                           | Cons                                                  |
| ------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------- |
| **SPH**                         | Density = weighted sum of neighbour particles, pressure from density | Simple                                         | Needs neighbour search; compresses a lot unless stiff |
| **PBF** (Position Based Fluids) | Density constraint, iterative position projection                    | Stable with large steps, common in games       | A bit "gooey", needs neighbour search                 |
| **FLIP/PIC**                    | Particles carry velocity, grid solves pressure                       | VFX standard, very lively water (Bridson ch.7) | Needs a pressure solver, particle noise               |
| **APIC**                        | Like PIC, but particles also carry a matrix `C`                      | Keeps vortices, less noise than FLIP           | Larger particle memory                                |
| **MLS-MPM**                     | APIC + stress computed on the grid, no pressure solve                | No neighbour search, very GPU-friendly         | Water is slightly compressible                        |

### 7.2 MLS-MPM: the formulation that ran in Golden Cove

**Particles** store: position, velocity `v`, affine matrix `C` (3×3), density, foam. About 80 bytes each.
**Grid**: each node holds `(m·vx, m·vy, m·vz, m)` as **atomic integers** (fixed-point ×1e5), because many particles add into the same node at once.

Each substep has 5 compute kernels:

```
1. clearGrid    : clear the grid
2. P2G-1        : each particle splats mass and APIC momentum  m·(v + C·d)  onto 27 nodes
                  (quadratic B-spline weights: w = 0.5(0.5−d)², 0.75−d², 0.5(0.5+d)²)
3. P2G-2        : particle reads back density ρ = Σ w·m_node
                  Tait pressure  p = K·((ρ/ρ₀)⁵ − 1),  clamped p ≥ 0
                  stress σ = −p·I + μ(C + Cᵀ)
                  splat momentum  −Δt · (1/ρ) · 4 · σ · d · w  onto 27 nodes
4. updateGrid   : v = momentum / mass; add gravity;
                  collide with solids via an SDF (remove the velocity component going into them);
                  box walls; piston wavemaker
5. G2P          : particle gathers new v and C from the grid (C = 4·Σ w·v·dᵀ), moves,
                  is pushed out of solids, updates foam
```

**Starting parameters that worked** (grid units, time in seconds):

| Parameter                      | Value                           | Note                                                         |
| ------------------------------ | ------------------------------- | ------------------------------------------------------------ |
| `ρ₀`                           | 4 particles/cell                | Seed particles `ρ₀^(−1/3) ≈ 0.63` cells apart, jittered ±0.2 |
| `c_s` (artificial sound speed) | 75–125 cells/s                  | About 6× the wave speed. `K = c_s²·ρ₀/5`                     |
| Δt                             | `(1/60)/substeps`, 5–7 substeps | `c_s·Δt ≈ 0.33` cells                                        |
| `g`                            | `9.81/Δx` cells/s²              |                                                              |
| Viscosity μ                    | 0.1                             |                                                              |
| Bed friction                   | **≈ 0.02**                      | See bug #1 in section 11                                     |
| Velocity clamp                 | 8 m/s                           |                                                              |

**Key tips:**

- **Seed about 1 cell above the target water level.** Particles at the surface and near the bed lack neighbours and settle, so the water drops by roughly one cell in the first second. Then measure the real level and adjust decorative parts (outer sea, wet sand) to it.
- **Foam:** increases when a particle is fast (> 2 m/s) or thrown loose (density < 0.55ρ₀ _and_ moving). It decays with a lifetime of about 3 s.
- **Per-column data:** count particles in each (x, z) column to get depth `count/ρ₀·Δx`. Use it for wet sand and caustics. Don't use "the highest particle in the column", because one airborne droplet ruins the depth.

### 7.3 Passing particle data to Three.js without copying to the CPU

With `WebGPURenderer`, create your own `GPUBuffer` and assign it to the attribute before three uses it:

```js
const attr = new THREE.StorageInstancedBufferAttribute(new Float32Array(N * 4), 4)
renderer.backend.get(attr).buffer = myGPUBuffer // three reuses the existing buffer
// in TSL: storage(attr, 'vec4', N).toReadOnly().element(instanceIndex)
```

The compute shaders are plain WGSL running on `renderer.backend.device`, submitted on the same queue before rendering, so ordering is always correct. Note: this relies on three's internal API, so pin the version (we used `three@0.184.0`).

---

## 8. Rendering water

### 8.1 Two-pass architecture

The water shader needs to know **what's behind the surface** and **how far away it is**:

```
Pass 1: draw the scene WITHOUT water into a render target  →  tColor + tDepth
Pass 2: draw the scene again + the water; the water reads tColor, tDepth
```

The water composites its own background, so it's drawn **opaque** (no blending). This avoids every transparency-sorting headache.

### 8.2 Water thickness from depth

```glsl
float z  = -perspectiveDepthToViewZ(texture(tDepth, uv).r, near, far); // along the camera axis
float sd = z / dot(rayDir, camForward);       // convert to distance along the view ray (easy to forget!)
float wd = length(waterPos - camPos);
float thick  = max(sd - wd, 0.0);             // how far light travels through water
float vdepth = thick * max(-rayDir.y, 0.08);  // vertical depth, used for foam
```

### 8.3 Absorption (Beer–Lambert law)

Light through water is absorbed exponentially, with a different coefficient per colour. Red is lost fastest, so deep water turns blue-green:

```glsl
vec3 trans = exp(-sigma * path);                 // sigma for tropical water ≈ (0.46, 0.09, 0.07) /m
vec3 scat  = waterColor * (1.0 - exp(-0.5 * path));
vec3 col   = bg * trans + scat;
```

- **Grazing views** make `path` very long, so the far area becomes one flat colour. Fix: blend the view-ray distance with vertical depth (`mix(path, vdepth*1.8, 0.55)`).
- **Stylized look:** replace the exponential with a 2–3 colour ramp (shallow, mid, deep) driven by `t = 1 − exp(−path·k)`, then quantise it.

### 8.4 Screen-space refraction

```glsl
vec2 ruv = uv + normal.xz * 0.03 * clamp(thick * 0.12, 0.0, 1.0);
if (sceneDist(ruv) < waterDist) ruv = uv;   // REQUIRED: don't pull objects in front into the water
```

### 8.5 Fresnel and reflection

```glsl
float F = 0.02 + 0.98 * pow(1.0 - max(dot(-rd, n), 0.0), 5.0);   // Schlick, water F0 = 0.02
vec3 refl = sky(reflect(rd, n));
col = mix(col, refl, F);
```

Looking straight down the water is clear; at grazing angles in the distance it's a mirror. If the reflected ray points below the horizon (on wave edges), use the background colour instead of a dark sky colour, or wave edges get black rims.

### 8.6 Caustics

| Method                                                                                                    | Accuracy               | Cost            | Used in                      |
| --------------------------------------------------------------------------------------------------------- | ---------------------- | --------------- | ---------------------------- |
| **Area ratio:** refract a grid of light rays through the surface, compare triangle areas before and after | Follows the real waves | One render pass | Pool Water Lab               |
| **Voronoi F2 − F1:** time-animated noise                                                                  | Fake, but pretty       | Very cheap      | Lighthouse Isle, Golden Cove |

Voronoi:

```glsl
// bright on the borders between cells; add 2 layers at different scales to reduce repetition
return 1.0 - smoothstep(0.0, 0.12, sqrt(F2) - sqrt(F1));
```

Multiply by `exp(−depth·k)` and fade it out near the surface. Inject it into built-in materials with `onBeforeCompile` (before `#include <dithering_fragment>`).

### 8.7 Foam

| Type                    | How                                                                                            | Notes                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Contact edge**        | `1 − smoothstep(0, w + noise, vdepth)`                                                         | Appears around every object automatically thanks to depth; no need to know where objects are |
| **Second foam line**    | Compare `vdepth` to a value oscillating with `sin(t)`                                          | Gives a lapping-in-and-out feel                                                              |
| **Wave crests**         | `smoothstep` on normalised height × a noise band                                               | High threshold (0.72–0.86), or it turns into big white blotches                              |
| **From the simulation** | Store "foam" on particles or cells, raise it on speed or impact, decay over time               | Golden Cove                                                                                  |
| **Spray particles**     | CPU particle system, emitted when a crest _just crosses_ a threshold at a windward shore point | See 9.4                                                                                      |

### 8.8 Rendering liquid from particles (Screen-Space Fluid Rendering)

For group E:

```
1. Draw each particle as a small sphere, write sphere depth  → depth RT (R32F)
2. Draw particles additively for thickness                  → thickness RT (RGBA16F, additive)
3. Smooth depth: 13-tap bilateral, horizontal then vertical, 2–3 times
4. Rebuild position and normal from the smoothed depth
5. Shade: refraction, thickness-based absorption, Fresnel, foam
```

Notes:

- Calibrate thickness: divide by `ρ₀ · (4/3)π · (r/Δx)³` so summed thickness equals the real distance through water.
- Scale the bilateral threshold with distance: `tol = max(base, d₀·0.06)`. Otherwise grazing views show horizontal streaks.
- Compute normals with a 2-texel offset; pick the side with the smaller difference to avoid edge halos.
- Particles seeded on a regular lattice show streaks at grazing angles: jitter initial positions by about 0.4 of the spacing.
- Thin water (swash, puddles): bias normals toward up and fade alpha with thickness.

### 8.9 Underwater

- **Snell's window:** looking up from below, the sky is visible only inside a cone of about 97°. Outside it the surface reflects totally, showing the bottom colour.
- Distance fog in the water colour, light shafts (god rays), bubbles and floating motes (Pool Water Lab).

### 8.10 Stylized (toon) look

- Colour banding: `(floor(t·N) + smoothstep(0.4, 0.6, fract(t·N))) / N`. Softer than a hard `floor`, so no jagged edges.
- Sun glints: `step(0.45, spec + noise·0.35)` gives scattered, sparkly spots.
- Hard `step` white foam, a crisp Fresnel rim.
- No tone mapping (ACES shifts the colours you picked).
- Box cross-section: water walls whose top edge follows the wave function, coloured by depth below the surface.

---

## 9. Interaction with objects

### 9.1 Floating objects (buoys, boats)

Use the JS height function:

```js
const h = waveHeight(x, z, t)
const hx = waveHeight(x + 1, z, t) - h,
	hz = waveHeight(x, z + 1, t) - h
obj.position.y = h - draft // draft: submerged part
obj.rotation.set(hz * 0.6, 0, -hx * 0.6)
```

For inertia, use a damped spring toward `h` instead of assigning it directly.

**More accurate buoyancy:** sample a few points under the hull. For each point below the surface, add an upward force `ρ·g·V_submerged` and a drag force opposing motion.

### 9.2 Objects pushing water (one-way coupling)

Bridson §15.1:

- **Heightfield:** when an object passes through, subtract its volume from `h` in the cells it occupies, or add a negative bump. The displaced water spreads out as waves (the buoy in Pool Water Lab).
- **SWE:** set the velocity in cells occupied by the object to the object's velocity.
- **MPM:** in `updateGrid`, nodes inside the object get the object's velocity. The piston wavemaker is exactly this case.

### 9.3 Wavemaker (piston)

A piston oscillating as `X(t) = A·sin(ωt)` makes waves of height `H`:

```
H / S = 2(cosh 2kd − 1) / (sinh 2kd + 2kd)      (S = 2A is the stroke)
solve k from ω² = g·k·tanh(k·d) by iteration:  k ← ω² / (g·tanh(k·d)), 40 iterations
```

Ramp the amplitude up over the first ~6 s to avoid an initial shock. Add a small secondary component (×0.14, frequency ×1.13) so the waves aren't machine-regular.

### 9.4 Spray when waves hit

```js
// each shore emitter has: position, outward normal, previous h, cooldown
if (h > thr && prev <= thr && cool <= 0 && facing > -0.15) { burst(...); cool = 0.5; }
```

- Check for **just crossing** the threshold (`prev ≤ thr < h`) so each wave produces exactly one burst.
- `facing = −dot(normal, windDir)`: the windward side splashes harder.
- Find the shoreline by **bisection** on the terrain function: for each direction, find the radius where the bed height equals 0.
- Particles die when they fall below the surface. Call the JS wave function to know where the surface is.

---

## 10. Platforms and performance

### 10.1 WebGL2 or WebGPU

|                               | WebGL2                          | WebGPU                                       |
| ----------------------------- | ------------------------------- | -------------------------------------------- |
| Grid simulation               | Fragment-shader ping-pong, fine | Compute shaders, cleaner                     |
| Particle simulation (scatter) | Very hard (no atomics)          | Has atomics, MPM runs directly               |
| Reading scene depth           | `DepthTexture`                  | `DepthTexture`                               |
| Browser support               | Everywhere                      | Chrome/Edge 113+, Safari 26+, recent Firefox |
| Three.js                      | `ShaderMaterial` + GLSL         | `WebGPURenderer` + TSL (or plain WGSL)       |

If it must run everywhere, use WebGL2 with groups A/B/C. If you need 3D particles, use WebGPU and prepare a clear message for browsers without it.

### 10.2 Reference budgets

| Technique            | Size used                      | Where it runs        |
| -------------------- | ------------------------------ | -------------------- |
| Wave equation        | 256², several substeps         | GPU (WebGL)          |
| Wave equation (pond) | 128²                           | CPU                  |
| SWE                  | 160×80 to 192×64               | CPU (~2 ms/step)     |
| 3D smoke and fire    | 48×80×48, 28 Jacobi iterations | GPU (WebGL atlas)    |
| MLS-MPM              | 17k / 40k / ~80k particles     | GPU (WebGPU compute) |
| Gerstner surface     | 280² mesh                      | GPU vertex shader    |

### 10.3 Performance tips

- **Substep** the simulation; cap steps per frame (e.g. ≤ 12) so weak machines don't freeze.
- Simulate at low resolution, render at high resolution. The SSFR particle passes can run at 0.5–0.75 of screen resolution.
- Clamp `dt ≤ 0.05 s` so returning to a hidden tab doesn't trigger one giant step.
- CPU: use flat `Float32Array`s with index `i + nx*j`. Swap an RK2 backtrace for Euler when you need 2× speed.
- Uploading to the GPU via `DataTexture` every frame only makes sense for grids of a few hundred thousand cells.

### 10.4 Testing without a real GPU

- Check the numerics in Node (no rendering): no NaN, volume conserved, compare against analytic solutions.
- Headless Chromium with SwiftShader runs both WebGL and WebGPU, but WebGPU needs headful mode (Xvfb) and is very slow.
- When running WebGPU compute without drawing, wait for `queue.onSubmittedWorkDone()` before submitting more. Otherwise the queue balloons and the GPU process gets killed.

---

## 11. Bugs we hit

| #   | Symptom                                              | Cause                                                                                                    | Fix                                                                                                    | Demo             |
| --- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------- |
| 1   | Waves die out before reaching the shore              | Sand-style Coulomb friction (μ = 0.35) applied to the near-bed water layer, decelerating it by about μ·g | Bed friction for water ≈ 0.02                                                                          | Golden Cove      |
| 2   | Water level ends up below the design level           | Surface and near-bed particles lack neighbours and settle                                                | Seed 1 cell higher, re-measure the level after 1.2 s                                                   | Golden Cove      |
| 3   | Sand rim at the box walls, water looks like a pool   | Gap between the outer sea plane and particles clamped away from the walls                                | Clamp particles to `[1, N−1.01]` instead of `[1.5, N−2.5]`; draw the outer sea only in the edge strips | Golden Cove      |
| 4   | Dry sand shows caustics as if underwater             | Depth taken from the highest particle in the column (airborne droplets skew it)                          | Count particles per column → depth                                                                     | Golden Cove      |
| 5   | Horizontal streaks at grazing angles                 | Particles on a regular lattice; bilateral filter too strict on depth                                     | Jitter initial particles, distance-scaled threshold, 2-texel normals                                   | Golden Cove      |
| 6   | Dark blue-black rims around puddles                  | Edge normals point sideways and reflect the below-horizon colour                                         | Bias normals up for thin water; use the background colour below the horizon                            | Golden Cove      |
| 7   | Dam breaks but water doesn't spill                   | Extrapolating `h` into lower dry cells blocks the flow                                                   | For lower dry cells, use `h = b`                                                                       | Dam Break Valley |
| 8   | Wave equation can't flood dry land                   | Inherent to the linear model                                                                             | Use full SWE (with advection)                                                                          | Dam Break Valley |
| 9   | Big cloud-like white blotches on crests              | Crest foam threshold too low                                                                             | Threshold 0.72–0.86 × a noise band                                                                     | Lighthouse Isle  |
| 10  | Far half of the box is one flat dark blue            | Absorption used only the view-ray distance                                                               | Blend with vertical depth                                                                              | Lighthouse Isle  |
| 11  | Object bases get "pulled" into the water             | Refraction sampled an object in front of the surface                                                     | Re-check depth after the offset; drop the offset if wrong                                              | All demos        |
| 12  | Water mesh edges shift, box loses its square corners | Gerstner horizontal displacement at the boundary                                                         | Turn off horizontal displacement near the edges                                                        | Lighthouse Isle  |
| 13  | Ripples too fast for a pond                          | Real depth used in `c² = g·d`                                                                            | Effective depth factor ~0.18                                                                           | Ao Sen           |
| 14  | ShaderMaterial colours too dark or too saturated     | Missing linear → sRGB conversion                                                                         | `#include <colorspace_fragment>` at the end of the fragment shader                                     | All demos        |
| 15  | WebGPU "device lost" during testing                  | Submitting compute continuously without waiting for the GPU                                              | Wait for `onSubmittedWorkDone()` when no frames are presented                                          | Golden Cove      |

---

## 12. Ready-made recipes for game scenarios

**Open-world ocean**
FFT ocean (2–3 layers) or 4–8 Gerstner waves. Depth-based colour, Fresnel, crest foam, shore foam from depth. Boats with multi-point buoyancy.

**Interactive pond, lake or pool**
GPU wave equation at 128²–256², with small Gerstner waves layered on for wind. Area-ratio caustics (pools) or Voronoi (ponds). Falling objects add a negative bump and spawn particles.

**Beach with waves coming ashore, tides**
SWE near the shore, a piston or open boundary on the sea side, Gerstner further out. Wet sand via a "wetness" map that fades over time.

**Floods, dam breaks, canals and sluice gates (puzzle games)**
SWE with wet/dry handling and bed friction. Validate against Ritter. Hide breaking water with foam particles.

**Showcase water effects (pouring a glass, waves hitting rocks, small waterfalls)**
MLS-MPM on WebGPU in a small box, rendered with SSFR. The sea outside the box is a wavy plane whose level matches the measured simulation level.

**Cartoon style, mobile**
Gerstner + toon (colour banding, hard foam, sun glints). Voronoi caustics injected into toon materials. Spray as a few thousand CPU particles. The whole scene runs on WebGL2.

**Smoke, steam, fire**
3D grid as an atlas in WebGL, buoyancy + vorticity confinement, ray-marching, black-body colour.

---

## 13. References

### Demos in this project

| Demo               | Main techniques                                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Pool Water Lab     | GPU wave equation, area-ratio caustics, underwater view with Snell's window, buoy pushing water                                     |
| Shoaling Beach Lab | SWE on a MAC grid, sloped beach, piston, open boundary, run-up                                                                      |
| Ao Sen             | CPU wave equation, refraction, koi driven by steering behaviours (Buckland)                                                         |
| Flame Lab          | 3D grid atlas, thin flames and volumetric combustion, ray-marching                                                                  |
| Dam Break Valley   | SWE with wet/dry, comparison with Ritter, open boundary vs wall                                                                     |
| Golden Cove MPM    | WebGPU MLS-MPM, SSFR, particle foam, wet sand                                                                                       |
| Lighthouse Isle    | Gerstner + toon, see-through water, depth-based foam, spray, box cross-section. Step-by-step guide in `lighthouse-isle-tutorial.md` |

### _Fluid Simulation for Computer Graphics_ (Bridson, 2nd ed.)

| Chapter | Content                                                 | Use when                                |
| ------- | ------------------------------------------------------- | --------------------------------------- |
| 1–2     | Fluid equations, splitting, grids                       | Foundations                             |
| 3       | Semi-Lagrangian advection, reducing numerical diffusion | Every grid solver                       |
| 4       | Level sets, SDFs, data extrapolation                    | 3D water surfaces, SDF collisions       |
| 5       | Pressure, incompressible projection                     | 3D grids, FLIP                          |
| 6       | Smoke, buoyancy                                         | Smoke, steam                            |
| 7       | Particle methods, PIC/FLIP                              | High-quality 3D water                   |
| 8       | Water, volume control (§8.4)                            | Free-surface 3D water                   |
| 9       | Fire                                                    | Fire                                    |
| 11      | Vorticity, vorticity confinement                        | Adding detail                           |
| 12      | Shallow water (§12.2 waves, §12.3 discretisation)       | Groups B, C                             |
| 13      | Ocean modelling                                         | Group A (FFT)                           |
| 15      | Coupling fluids and solids (§15.1 one-way)              | Floating objects, objects pushing water |

### Recommended papers and resources

- Jerry Tessendorf, _Simulating Ocean Water_ (2001): FFT oceans.
- Jos Stam, _Stable Fluids_ (SIGGRAPH 1999): the classic grid solver.
- Macklin & Müller, _Position Based Fluids_ (2013): particle fluids for games.
- Jiang et al., _The Affine Particle-In-Cell Method_ (2015): APIC.
- Hu et al., _A Moving Least Squares Material Point Method_ (2018): MLS-MPM.
- van der Laan et al., _Screen Space Fluid Rendering with Curvature Flow_ (2009): SSFR.
- _GPU Gems 1_, chapter 1 "Effective Water Simulation from Physical Models": Gerstner waves on the GPU.
