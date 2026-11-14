# Real-Time Water Simulation: A Reusable Guide

Distilled from **Minamo** (three.js `WebGPURenderer` + hand-written WGSL). This guide explains _how_ the water is built, _why_ each choice was made, and which pitfalls cost real debugging time. It is written so the ideas transfer to other stacks: plain WebGPU, WebGL2, Unity/HDRP/URP, Unreal or a custom engine.

Source map (for reference while reading):

| Topic                                              | File                                   |
| -------------------------------------------------- | -------------------------------------- |
| Wave spectrum (CPU)                                | `src/ocean/spectrum.js`                |
| FFT simulation (GPU compute)                       | `src/ocean/ocean.js`                   |
| Wave function + underwater optics as shader nodes  | `src/ocean/oceanNodes.js`              |
| Water surface mesh + material                      | `src/ocean/waterMaterial.js`           |
| Caustics                                           | `src/ocean/caustics.js`                |
| Waterline test, underwater fog, light shafts, lens | `src/post/post.js`                     |
| Lighting of opaque objects under water             | `src/scene/world.js` (`underwaterize`) |
| Frame order                                        | `src/main.js` (`frame()`)              |
| All tunables                                       | `src/params.js`                        |

---

## 1. Architecture at a glance

Water is not one effect. It is six subsystems that must all agree on **one wave function** and **one answer to "is this pixel under water?"**:

```
                 ┌─────────────────────────────────────────────┐
  CPU: spectrum  │  GPU compute (per frame)                    │
  h0(k), once ──►│  spectrum(t) → IFFT rows → IFFT cols →      │
                 │  assemble (disp, slopes, Jacobian foam) →   │
                 │  mips → caustics                            │
                 └───────────────┬─────────────────────────────┘
                                 │ same textures everywhere
     ┌───────────────┬───────────┼──────────────┬──────────────────┐
     ▼               ▼           ▼              ▼                  ▼
 water mesh     waterline     opaque scene   underwater post    CPU readback
 (vertex disp,  test per px   lighting       (fog/scatter,      (heightAt for
 shading)       (nearS tex)   (depth, caus.) light shafts)      game logic)
```

Frame order (from `main.js`):

1. **Ocean compute**: FFT → displacement/derivative/foam textures → mips → caustics.
2. **Near-plane test (`nearS`)**: per pixel, signed height of the camera near-plane point above the water. One r32float texture that every later pass reads to decide "above or below".
3. **Opaque scene** into an HDR target (rgba16f + depth). Materials apply underwater attenuation and caustics themselves.
4. **Water surface**: copy colour + linear depth into a "backdrop" texture → draw **back faces** → copy again → draw **front faces**.
5. **Post**: half-res light shafts → underwater compositing → blur pyramid → lens water film → lens layer → bloom → auto exposure → tone mapping.

> **Key lesson:** decide early that the wave function lives in exactly one place conceptually and is replicated _bit-for-bit_ wherever it's evaluated (vertex shader, compute pass, CPU). Most visible bugs at the waterline come from two slightly different evaluations of the surface.

---

## 2. Ocean simulation: Tessendorf FFT

### 2.1 Spectrum (CPU, once per parameter change)

Built in `spectrum.js` and uploaded as `h0(k)` per texel: `vec4(h0(k), conj(h0(-k)))`.

- **Wind sea:** fetch-limited **JONSWAP** (γ = 3.3):
  ```
  α  = 0.076 · (U² / (F·g))^0.22
  ωp = 22 · (g² / (U·F))^(1/3)
  S(ω) = α g² / ω⁵ · exp(-1.25 (ωp/ω)⁴) · γ^r,   r = exp(-(ω-ωp)² / (2σ²ωp²)),  σ = 0.07 | 0.09
  ```
- **Directional spreading:** **Donelan–Banner** `sech²(βθ)` with β depending on ω/ωp (Horvath 2015).
- **Swell:** a second, long and narrow JONSWAP-shaped peak (γ = 6) with a tight `cos^(2s)(θ/2)` lobe (s = 24), scaled so its significant height equals the requested value (`Hs = 4√m0`; m0 integrated numerically and cached).
- **Capillary cutoff:** multiply by `exp(-k² l²)`, l = 4 mm, so the finest cascade does not "fizz".
- **Conversion to wavenumber space:** `S(k) = S(ω) · dω/dk / k`, with deep-water dispersion `ω = √(g k)`, `dω/dk = g / (2ω)`.
- **Amplitude per texel:** `|h0| = √(2 S(k) Δk²)`, times a complex Gaussian random number.
- **Deterministic RNG** (mulberry32, fixed seed) → the sea looks identical on every load, which makes screenshots and A/B comparisons reproducible.

Default params (`params.js`): wind 5 m/s, fetch 20 km, swell 0.22 m / 55 m wavelength, choppiness 0.75. This is a calm tropical bay; scale wind/fetch up for open ocean.

### 2.2 Cascades

Three 256² cascades with **non-overlapping wavenumber bands**:

| Cascade | Tile size L | k range            |
| ------- | ----------- | ------------------ |
| 0       | 250 m       | 0 … 2π·6/37        |
| 1       | 37 m        | 2π·6/37 … 2π·6/7.3 |
| 2       | 7.3 m       | 2π·6/7.3 … ∞       |

Lessons:

- Use **incommensurate tile sizes** (250 / 37 / 7.3) so tiling repetition never lines up.
- **Cut the bands** (`kMin/kMax`) so no frequency is counted twice. Overlap adds energy and doubles the visible detail at the seams.
- The band edges sit at "6 wavelengths per tile" of the next cascade: each cascade only holds waves its resolution can represent well.

### 2.3 GPU passes per frame (`ocean.js`)

1. **Spectrum(t)**: `h(k,t) = h0(k) e^{iωt} + conj(h0(-k)) e^{-iωt}`, then derive 8 real fields in frequency space and **pack pairs into one complex FFT** (`A + iB`) since their spatial results are real:
   - `Dx, Dz` (choppy horizontal displacement `-i k/|k| h`)
   - `Dy` (height) and `∂Dx/∂z`
   - `∂Dy/∂x, ∂Dy/∂z` (slopes)
   - `∂Dx/∂x, ∂Dz/∂z` (for the Jacobian)
     → 4 complex FFTs instead of 8.
2. **IFFT rows**, then **IFFT columns**: radix-2 Stockham/DIT in **workgroup shared memory**, one workgroup of N/2 threads per line, bit-reversed load, log₂N butterfly stages with `workgroupBarrier()`. A `HORIZONTAL` override constant picks the direction from one shader.
3. **Assemble**: apply the `(-1)^(x+y)` sign flip (centred spectrum), choppiness λ, compute the **Jacobian** `J = (1+Dxx)(1+Dzz) − Dxz²`, and update persistent **foam**:
   ```
   foam = max(foam_prev · exp(-dt·decay), clamp((bias − J) · gain, 0, 1))
   ```
   Outputs (rgba16float, wrap):
   - `disp  = (Dx, Dy, Dz, ∂Dx/∂z)`
   - `deriv = (∂Dy/∂x, ∂Dy/∂z, ∂Dx/∂x, ∂Dz/∂z)` (mipmapped)
   - `foam  = (foam, J, (∂Dy/∂x)², (∂Dy/∂z)²)` (mipmapped; the squared slopes are second moments for LEAN-style roughness)
4. **Mips** for `deriv` and `foam` (simple 2×2 box compute).

Cost: ~0.3 ms for FFT + assembly on a laptop RTX 4070. The FFT is not the bottleneck; rendering is.

### 2.4 Normal from derivatives (with choppy displacement)

With horizontal displacement the surface is `P(x,z) = (x + Dx, Dy, z + Dz)`, so the normal must use the full Jacobian, not just height slopes:

```
S = (∂Dy/∂x, ∂Dy/∂z, ∂Dx/∂x, ∂Dz/∂z),  Dxz = ∂Dx/∂z
N = normalize( S.y·Dxz − (1+S.w)·S.x ,
               (1+S.w)(1+S.z) − Dxz² ,
               Dxz·S.x − S.y·(1+S.z) )
```

### 2.5 Height at a world point (inverse displacement)

Texture coordinates are in _undisplaced_ space. To find the water height at world (x, z), invert the horizontal displacement with damped fixed-point iteration:

```
p = xz
repeat 6×: p = mix(p, xz − D(p).xz, 0.85)
height = D(p).y + seaLevel
```

This same algorithm is used on the GPU (waterline test) and the CPU (`Ocean.heightAt`, from an async readback of the displacement textures, 1–2 frames late). The CPU version is **only for logic** (floating camera, spawning lens drops, "is camera submerged").

---

## 3. The water surface mesh

### 3.1 Camera-centred radial grid (`makeRadialGrid`)

- 512 segments around, rings growing **geometrically** from 8 mm to 30 km: `r_j = rMin · g^j`, `g = 1 + 2π/512`. That keeps triangles roughly **square and of constant screen size** at every distance.
- Odd rings are rotated by half a segment (staggered) for better triangle shape.
- The grid follows the camera in xz (`paramXZ = local + camXZ`); `frustumCulled = false`.
- **Per-cascade fade by grid spacing**: a cascade is faded out where the local vertex spacing exceeds about two of its texels:
  ```
  spacing = r · 2π/512
  fade_c  = saturate(2 − spacing / (2 · L_c/256))
  ```
  This removes vertex aliasing ("swimming" sparkles far away) while the fragment shader still adds detail through normals.

### 3.2 Two draws: back faces, then front faces

Each side has its own backdrop copy: copy scene → draw back faces → copy (now including back faces) → draw front faces. The front faces refract an image that already contains the back faces, which gives crests seen through other crests a glassy look. (This mimics what three.js's DoubleSide transparent path does, but without its overhead.)

### 3.3 Choose above/below per pixel from the waterline test, not `frontFacing`

Folded crests (high choppiness) flip triangle winding, so `frontFacing` lies. The material reads the `nearS` texture at the pixel and branches on its sign. All passes then agree on the medium at every pixel.

---

## 4. Shading the surface

### 4.1 Camera above water

- **Exact unpolarised dielectric Fresnel** (n = 1.333), not Schlick: Schlick is noticeably wrong for the underwater side and TIR.
- **Reflection:** PMREM / pre-filtered sky at `R = reflect(-V, N)` with `R.y = |R.y|` (never reflect the ground below the horizon).
- **Sun:** GGX with roughness clamped to the **sun's angular radius** (`a ≥ 0.0047·2.5`), so the highlight never becomes a sub-pixel spike that flickers.
- **Specular anti-aliasing (LEAN-style):** variance from the mip chain of squared slopes:
  ```
  var = E[s²] − E[s]²       (per axis, from foam.zw mips vs deriv.xy mips)
  rough = clamp(sqrt(baseRough² + 0.5·(varX + varZ)), 0.02, 0.5)
  ```
  This is the single biggest fix for distant glitter/aliasing.
- **Refraction:** sample the backdrop with a **bounded screen-space offset** from the view-space normal, scaled by local water thickness and divided by distance. An "exact" re-projection along the refracted ray looked marbled and unstable; the bounded offset is stable.
  - If the refracted sample is _in front of_ the surface (depth < fragment depth), fall back to the straight sample (avoids pulling above-water objects into the water).
- **Water body colour:** the refracted sample goes through the **same closed-form absorption + single scattering as the underwater post pass** (§6), with path length = thickness / |dot(T, camFwd)|.
- **Subsurface glow** in crests: `pow(dot(V, −sunDir_horizontal), 4) · crestHeight · (1 − F)` tinted blue-green. Cheap, sells backlit waves.
- **Foam:** Jacobian foam × world-space noise (to break texel-shaped blobs) shaded as a rough white layer by sun + sky.
- `final = mix(mix(under, sky, F) + sunSpec + sss, foam, foamAmt)`.

### 4.2 Camera below water (looking up)

- Normal flipped into the water; Fresnel with η = 1/1.333 → **total internal reflection above 48.6°**.
- **Snell's window:** sample the sky along the refracted ray, multiply radiance by **n²** (radiance compression entering a denser medium) and by `(1 − F)`.
- **Outside the window (TIR):** reflect the water's own in-scattered light: evaluate the medium integral along the reflected ray.
  - **Pitfall (fixed bug):** near the waterline and on steep facets the reflected ray can point _up_. A fixed-length (200 m) segment then integrates "water" above the surface, where `exp(+Kd·height)` grows faster than extinction → a **pink/orange glow**. Fix: force `Rd.y ≤ −0.1` for the TIR term, and in the segment function cap the distance of upward rays at the surface (`dist = min(dist, depth0 / dirY)`).

### 4.3 HDR safety

The target is half float. An unclamped sun highlight overflows to Inf, and the bloom pyramid smears it into white polygons. **Clamp every material output** (`clamp(out, 0, 20000)`) and sanitize NaN/Inf at the entry of post.

---

## 5. The waterline (over-under / half-submerged camera)

This is the hardest part and the one that most water renderers get wrong.

### 5.1 Why it is hard

The near plane of a 55° FOV camera at 5 cm is only **~7 cm wide**. Whatever error there is in the surface height gets magnified across the whole screen at the waterline: a 4 mm error is a visible step.

### 5.2 The per-pixel near-plane test (`nearS`)

For each pixel, unproject to the near plane (clip z = 0 in WebGPU), evaluate `heightAt(p.xz)` with the _same_ wave function as the mesh, and store `s = p.y − height` in an r32float texture. `s ≥ 0` → camera medium is air for this pixel.

Every later consumer reads this texture: the water material, underwater compositing, light shafts, lens film sim, lens layer. **Their waterlines therefore agree by construction.**

> Note the coordinate system: in three.js WebGPU, set `camera.coordinateSystem = THREE.WebGPUCoordinateSystem` _before_ the first render if you unproject in a compute pass before three.js has rendered once; otherwise the first frame uses the WebGL clip-z convention.

### 5.3 Filtering precision (the subtle part)

- **GPU bilinear filtering keeps only ~8 bits of sub-texel position.** On the 250 m cascade (≈1 m texels) that is ≈4 mm → small steps along the waterline every ~100 px. Fix: **exact f32 bilinear** from 4 `textureLoad`s for the coarse cascades.
- **Bilinear kinks on the finest cascade:** at 2.85 cm texels the piecewise-linear surface produces visible corners on the 7 cm near plane. Fix: **cubic B-spline from 4 bilinear taps** (GPU Gems 2, ch. 20) for cascade 2.
- **Cost control:** use the exact filter only for the **final** height; the 6 fixed-point iterations (which only invert horizontal displacement) can use the hardware filter (`dispFast`). ≈4× cheaper with no visible difference.
- Both the TSL (mesh) and WGSL (waterline) versions must be **identical**. Keep a comment in both places: "must match X in file Y".

The same reasoning applies to normals in the fragment shader: coarse cascade slopes use B-spline too, otherwise the Snell's window / TIR edge follows polygonal iso-lines.

### 5.4 Shading the line on the lens

- Signed screen-space distance to the line: `sd = s / |∇s|`, with the gradient from a **wide central stencil** (±2 % of the screen) because 1-px differences drown in half-float noise.
- **~1 px anti-aliasing** across the cut: rebuild pixels within 3 px of the line from clean samples 4 px away on each side. This also hides the 1–2 px sliver where the water mesh meets the near plane.
- **One thin dark line** (~0.12 % of screen height, slightly blue). An earlier version drew a dark line plus a highlight → read as a thick slab. Real over-under photos show a **single** line.
- **Meniscus band** just above the line only refracts the above-water image. It must never sample the underwater side (that drew a blue band above the line). Clamp the refraction offset so it cannot cross toward water: `if (toWater > sd·0.8) offset += n_air · (toWater − sd·0.8)`.

### 5.5 Make the camera float

A camera at a fixed height rarely straddles the waterline in 0.5 m waves. In Minamo the scripted camera's y is **relative to the local water height**, with lag and distance fade:

```
floatH += (heightAt(cam.xz) − floatH) · (1 − exp(−dt / 0.35))
cam.y  = rel + floatH · exp(−|rel| / 0.8) · 0.85
```

This makes the waterline slosh across the lens like a handheld waterproof housing.

---

## 6. The underwater medium (participating media)

### 6.1 Coefficients (per RGB channel, clear tropical sea, Jerlov IA–IB)

|                     | R     | G     | B     |
| ------------------- | ----- | ----- | ----- |
| absorption σa (1/m) | 0.42  | 0.065 | 0.025 |
| scattering σs (1/m) | 0.020 | 0.030 | 0.045 |

- Extinction along a view ray: `σt = σa + σs`.
- Diffuse attenuation of downwelling light: `Kd ≈ σa + 0.25·σs`.
- Sun under water travels along the refracted direction, so the vertical attenuation is `Kd' = Kd / cosθ_refr` (clamp cos ≥ 0.2).
- For murkier water (coastal, lakes): increase σs a lot and shift σa toward yellow/green (Jerlov II–III or coastal types 1C–9C).

### 6.2 Closed-form single scattering

Along a segment starting at depth `depth0`, direction `v`, length `d`, both exponents are linear in the distance, so the integral has a closed form:

```
k     = σt − Kd' · v.y
L_sun = σs · p(μ) · E_sun · exp(−Kd'·depth0) · (1 − exp(−k d)) / k
k_a   = σt − Kd · v.y
L_amb = σs · E_sky · exp(−Kd·depth0) · (1 − exp(−k_a d)) / k_a · msBoost · 0.25
L     = L_scene · exp(−σt d) + L_sun · shafts + L_amb
```

- `msBoost` (≈2) approximates multiple scattering cheaply.
- Guard `k` with a signed epsilon (`safeK`) to avoid division by zero.
- **Phase function**, strongly forward: `0.85·HG(0.9) + 0.15·HG(0.2)`.
- This one function (`waterSegment`) is used in **three** places: underwater post (camera → scene), the water surface seen from above (surface → seabed), and TIR (reflected ray). Sharing it keeps colours consistent across the waterline.

### 6.3 Lighting opaque objects under water (`underwaterize`)

Patch every opaque material instead of approximating in post:

- `depth = waterHeight(p.xz) − p.y`, using the _current wave height_ (one inverse-displacement step is enough for lighting).
- Ambient: albedo × `exp(−Kd · depth)`.
- Direct sun: inject through the **shadow node**: `shadow × Fresnel_T × exp(−Kd'·depth) / T_amb × caustic(p, depth)`. Hooking the shadow term keeps PBR lighting intact and only scales the sun.
- **Wet band** above the waterline (≈0.7 m, noisy): albedo × 0.55, roughness × 0.35. Small detail, big realism.
- Smooth the in/out transition: `under = smoothstep(−0.02, 0.06, depth)`.

---

## 7. Caustics (`caustics.js`)

Evan Wallace's **area-ratio method**, rasterised:

1. A source grid on the water surface (one vertex every 2 receiver texels, plus 2 m margin) samples the FFT displacement and slopes.
2. Each vertex is refracted along the sun direction and intersected with a horizontal **receiver plane** at depth `Df` (3.2 m).
3. Triangles are rasterised into the receiver texture with **additive blending**; the fragment outputs `sourceArea / receiverArea` (via `dpdx/dpdy` of the source position) × Fresnel transmittance normalised by a flat surface (so the mean stays ≈ 1). Clamp to 40.
4. Drawn **3 times with IOR 1.3310 / 1.3335 / 1.3370** using colour write masks R/G/B → subtle chromatic dispersion.
5. **Mipmaps = defocus blur**: when sampling at depth d, `lod = |d − Df| · blur + 0.5` (+ extra blur very near the surface).

Practical details:

- 1024² texture covering a **20 m window that follows the camera**, **snapped to the source grid step** so the pattern doesn't swim when the camera moves.
- Shift the window by the mean refracted sun direction × depth so the pattern lands where the sun ray hits.
- The finest cascade contributes only 30 % (sampled at mip 1.5); at full strength the seabed fills with sparkle noise at 3 m.
- Fade caustics at the window edge and near the surface.
- Cost ≈0.7 ms (three passes). Possible optimisation: one pass, approximate dispersion at lookup time.

---

## 8. Light shafts (god rays)

- Ray-march the **caustic texture** along each underwater view ray (40 steps; 24 on low), **half resolution**, max 60 m, with interleaved-gradient jitter.
- Weight each sample by the view-ray transmittance `exp(−(σt − Kd'·v.y)·t)` and average.
- Averaging kills contrast → **re-expand**: `1 + (avg − 1) · 3.2`.
- Multiply only the **sun in-scatter term** by this factor (not the scene, not ambient).
- **Upsample with a joint bilateral filter**: bilinear weights × ray-length similarity; texels from the other medium are marked (`a = −1`) and ignored, so shafts never bleed across rock silhouettes or the waterline.

---

## 9. Lens effects (camera housing)

Not needed for every project, but they sell "a camera in the water":

- **Draining water film:** half-res semi-Lagrangian advection along _screen-space gravity_ (world down projected at screen centre), thicker film flows faster (`v ∝ 0.15 + film²`), per-column speed noise makes fingers. Decays with τ ≈ 0.9 s; "wetness" decays slower (τ ≈ 5 s).
- **Beads:** procedural spherical caps on a hashed cell grid, density ∝ wetness. Skip entirely when the lens is dry (perf).
- **Drops (CPU):** spawned where a coarse 32×18 grid of near-plane samples flips from under to above water (exactly where water just left the lens). Power-law radii, stick-slip sliding, trails, merging, evaporation; removed when submerged again. Uploaded as a small storage buffer.
- Refraction through the lens water: offset = gradient of water height × strength; drops get dispersion, blur, dark rims and a small highlight. **Do not** apply rims/glints to the meniscus (it creates a second line).

---

## 10. Post pipeline and tone

- Blur pyramid of the composited image (used for lens blur and exposure).
- Bloom: 13-tap downsample / tent upsample (CoD:AW style), clamp to avoid fireflies.
- Auto exposure: centre-weighted log-average luminance, adapted in log space.
- **AgX** tone mapping (handles saturated blue/cyan water much better than ACES, which hue-shifts).
- Supersampling (render at 1.25×, 4-tap resolve) instead of TAA. TAA with water needs motion vectors for vertex displacement, history rejection for pixels that change medium, and the lens must stay after TAA.

---

## 11. Performance notes (RTX 4070 laptop, 1080p, ~7 ms GPU)

| Part                                          | ms      |
| --------------------------------------------- | ------- |
| Opaque scene + shadow map                     | 2.5–3   |
| Water surface (two backdrop copies + 2 draws) | 1.3     |
| Caustics                                      | 0.7     |
| Waterline test                                | 0.5     |
| FFT + assemble                                | 0.3     |
| Underwater + shafts                           | 0.3–0.6 |
| Lens                                          | 0.4–1   |
| Bloom / exposure / tonemap                    | 0.4     |

Things that kept it fast:

- **No viewport-texture nodes in three.js materials.** Each `viewportSharedTexture()`/`viewportDepthTexture()` ends the render pass, copies the target and restarts. Do your own single backdrop copy (colour + linear depth in alpha) per side.
- **Compute the waterline once per pixel per frame**; everyone else reads it.
- **Half-res shafts** + bilateral upsample.
- Pack FFT fields in pairs; one workgroup per line in shared memory.
- Use r32float for the waterline (precision) and rgba16float elsewhere (bandwidth).
- Fade high cascades in the vertex stage by grid spacing.

---

## 12. Pitfalls checklist (each one cost real time)

1. **Two different wave evaluations** (mesh vs. waterline vs. CPU) → misaligned waterline. One function, replicated exactly.
2. **Hardware bilinear precision** (~8 sub-texel bits) → mm steps on large tiles. Use manual f32 bilinear where precision matters.
3. **Bilinear kinks on the finest cascade** at the near plane → B-spline.
4. **`frontFacing` on folded crests** → wrong medium branch. Use the per-pixel test.
5. **TIR segment integrating above the surface** → pink/orange glow. Cap upward rays at the surface.
6. **Unclamped HDR** → Inf → white polygons through bloom. Clamp and sanitize.
7. **Specular aliasing far away** → LEAN-style roughness from slope variance mips + sun angular radius floor.
8. **Exact screen-space refraction re-projection** → marbled/unstable. Bounded normal-based offset + depth test fallback.
9. **Refraction pulling foreground objects** into the water → fall back when the refracted depth is in front of the surface.
10. **Double line at the waterline** (dark line + highlight / meniscus sampling underwater) → single thin line, meniscus samples air only.
11. **Caustic window swimming** when the camera moves → snap the window to the source grid step.
12. **Finest cascade caustics** → noisy sparkle field. Reduce its contribution and blur.
13. **Overlapping cascade bands** → double energy. Partition k.
14. **Fixed-height camera** → rarely hits the waterline. Make the camera float relative to the surface.
15. **Clip-space convention on the first frame** (WebGPU z ∈ [0,1] vs WebGL [−1,1]) when unprojecting before the engine's first render.
16. **Non-deterministic spectrum / drops** → irreproducible captures. Seed every RNG.

---

## 13. Porting to other projects

### Choosing a scope

| Need                                   | Minimum set                                                                                          |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Stylised / mobile ocean                | Sum of Gerstner waves or a single small FFT, Schlick Fresnel, sky reflection, depth-based colour     |
| Realistic surface, camera always above | FFT cascades, radial grid, exact Fresnel, LEAN roughness, refraction + closed-form absorption, foam  |
| + Diving                               | `underwaterize` for opaque materials, underwater post (§6.2), Snell's window/TIR, caustics           |
| + Half-submerged camera                | Per-pixel near-plane test with an exactly matching wave function, waterline shading, floating camera |
| + Camera-housing look                  | Lens film, beads, drops                                                                              |

### Mapping to other engines

- **WebGL2 (no compute):** do the FFT as ping-pong fragment passes (Stockham, log₂N passes per direction). Write `nearS` with a full-screen fragment pass into an R32F target (needs `EXT_color_buffer_float`). Caustics already use rasterisation.
- **Unity (URP/HDRP):** FFT in compute shaders; water surface as a custom shader with `_CameraOpaqueTexture`/depth; waterline test as a full-screen compute or Renderer Feature before opaques; underwater fog as a post Renderer Feature reading the same mask. Hook underwater lighting through a shared shader include instead of the shadow-node trick.
- **Unreal:** Niagara/compute or Render Graph passes for FFT; material functions for the shared wave function; post-process material for underwater; custom stencil or a mask render target for the medium.
- **Game logic (buoyancy, floating cameras):** async GPU readback of displacement + CPU fixed-point inversion (§2.5). A couple of frames of latency is fine for logic; never use it for rendering.

### Parameters worth exposing

Wind speed, fetch, wind direction, swell height/length/direction, choppiness, foam decay/bias/gain, σa, σs, multiple-scattering boost, roughness, refraction strength, caustic depth/strength/blur, shaft strength/steps, render scale. Put them in one file with URL overrides (as `params.js` does); it makes tuning and bug reports much faster.

---

## 14. References

- Tessendorf, _Simulating Ocean Water_, SIGGRAPH 2001 course notes.
- Horvath, _Empirical Directional Wave Spectra for Computer Graphics_, DigiPen 2015.
- Bruneton, Neyret, Holzschuch, _Real-time Realistic Ocean Lighting using Seamless Transitions from Geometry to BRDF_, EG 2010 (LEAN-style roughness).
- Hillaire, _Physically Based and Unified Volumetric Rendering in Frostbite_, SIGGRAPH 2015.
- Solonenko & Mobley, _Inherent optical properties of Jerlov water types_, Applied Optics 2015.
- Akkaynak et al., _What Is the Space of Attenuation Coefficients in Underwater Computer Vision?_, CVPR 2017.
- Monzón et al., _Multiple Scattering Approximation for Real-time Underwater Spectral Rendering_, STAG 2022.
- Pope & Fry, _Absorption spectrum (380–700 nm) of pure water_, Applied Optics 1997.
- Evan Wallace, _WebGL Water_ and _Rendering Realtime Caustics in WebGL_.
- GPU Gems 2, ch. 20: _Fast Third-Order Texture Filtering_ (B-spline from bilinear taps).
- gasgiant/FFT-Ocean, Crest (ideas).
