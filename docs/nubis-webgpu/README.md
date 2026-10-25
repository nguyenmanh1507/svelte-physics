# Nubis · Realtime Volumetric Cloudscapes — Three.js WebGPU

Tái hiện kỹ thuật **Nubis** của Guerrilla Games (Andrew Schneider, *Horizon Zero Dawn*) bằng
**Three.js WebGPU + TSL + WGSL**. Không cần bundler: `index.html` dùng import map trỏ tới CDN.

```bash
npm run dev          # hoặc: python3 -m http.server 5173
# mở http://localhost:5173  (Chrome / Edge 113+, cần WebGPU)
```

Điều khiển: **kéo chuột** để nhìn · **W A S D** di chuyển · **E / Q** lên / xuống · **Shift** bay nhanh (bay lên 2 600 m để vào trong mây, 5 000 m để nhìn từ trên xuống).

## Kiến trúc

```
src/
├─ wgsl/common.js     remap(), hash PCG, Perlin & Worley 3D tileable, Henyey‑Greenstein
├─ noiseTextures.js   compute shaders → shape 128³ (Perlin‑Worley + Worley fBm), detail 32³,
│                     curl 128², weather map 512² (R coverage, G precipitation, B type)
├─ cloudShader.js     ray‑marcher WGSL (density model + lighting model + renderer)
├─ skyShader.js       bầu trời analytic đơn giản (gradient, mặt trời, màu ambient)
├─ flyControls.js     camera bay
└─ main.js            Three.js: scene pass → cloud pass (½ res) → composite, lil‑gui
```

### 1. Density model (slide 6‑15, GPU Pro 7)
| Nubis | Trong code |
|---|---|
| Cloud map 2D: coverage / type | `weatherTex`, lấy mẫu theo world XZ (`sampleWeather`) |
| Height gradient theo cloud type (stratus → stratocumulus → cumulus) | `densityHeightGradient()` |
| `base = remap(lowFreq.r, lowFreqFBM − 1, 1, 0, 1)` | Perlin‑Worley R + Worley fBm GBA của texture `shape` |
| `cloud = remap(base·gradient, 1 − coverage, 1, 0, 1) · coverage` | erosion bằng coverage, không nhân |
| Curl distortion + `remap(cloud, highFreqFBM·0.2, 1, 0, 1)` | `curlTex` + texture `detail`, wispy ở đáy / billowy ở đỉnh |
| `sample_pos += wind_direction * time` | `uAnim`, có thêm wind shear theo độ cao (`cloudTopOffset`) |

### 2. Lighting model (slide 21‑29)
`Energy = Attenuation × Phase × InScattering`
- **Beer–Lambert** dọc 6 mẫu hình nón hướng về mặt trời (mẫu cuối đặt xa để bắt bóng của mây khác), chất lượng giảm dần dọc nón.
- **Henyey–Greenstein** hai thuỳ với *silver lining* điều khiển được (`eccentricity`, `silverIntensity`, `silverSpread`).
- **In‑scattering probability** (SIGGRAPH 2017): `depthProb · verticalProb` – cạnh tối, lõi sáng, đáy mây tối hơn.
- Xấp xỉ multiple scattering bằng các octave `(attenuation, contribution, phase)` → dạng tổng quát của *Beer's‑Powder* 2015.
- Tích phân bảo toàn năng lượng theo Hillaire 2015 (`(S − S·T_step)/σ`).

### 3. Renderer (slide 30‑35)
- Lớp mây là **vỏ cầu** (1 500 – 4 000 m, bán kính Trái Đất 6 371 km) → mây cong về chân trời.
- "Do I need to render this pixel?": bỏ qua tia nhìn xuống đất, tia bị hình học che (scene depth), tia trên tầng mây.
- 64 mẫu nhìn lên → 128 mẫu ở chân trời. **Bước to + mẫu rẻ** (chỉ coverage + gradient + low‑freq noise) cho tới khi gặp density > 0 → lùi lại một bước → **bước nhỏ + mẫu đầy đủ** + 6 mẫu ánh sáng; ra khỏi mây vài mẫu thì quay lại bước to.
- Dừng sớm khi transmittance < 1 %. Pass mây render ở ½ (hoặc ¼) độ phân giải rồi composite với scene — tương đương với ý tưởng render thấp độ phân giải của Nubis (bản gốc dùng reprojection 1/16 pixel mỗi frame, chưa làm ở đây).
- Jitter (interleaved gradient noise) để phá banding.

### Debug views (GUI → Renderer → debugMode)
weather map · step heat‑map (chi phí ray march) · shape / detail / curl noise · density (cheap / full / alpha).

## Tham số nên thử
- *Cloud map*: `coverage` 0.3 – 0.9, `type` 0 (stratus) → 1 (cumulus), `precipitation` + `anvilBias` cho mây dông.
- *Lighting*: `extinction σ`, `silver lining`, `multi‑scatter octaves`, `ambientStrength`.
- *Renderer*: `maxSteps`, `renderScale` (0.25 nếu GPU yếu).

## Tài liệu
- Schneider, *Nubis – Realtime Volumetric Cloudscapes In A Nutshell* (Eurographics 2018)
- Schneider & Vos, *The Real‑time Volumetric Cloudscapes of Horizon Zero Dawn* (SIGGRAPH 2015)
- Schneider, *Nubis: Authoring Real‑Time Volumetric Cloudscapes…* (SIGGRAPH 2017), GPU Pro 7 ch. 4
- Schneider, *Nubis³* (SIGGRAPH 2023) – voxel clouds, không được tái hiện ở đây
- FarazzShaikh/three-volumetric-clouds (WebGL, Nubis Evolved envelope model)
