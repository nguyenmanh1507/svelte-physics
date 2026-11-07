# Sổ tay Water Simulation cho game và web 3D

Tài liệu tham khảo tổng hợp từ các demo trong project **Game Prototype** (Pool Water Lab, Shoaling Beach Lab, Ao Sen, Dam Break Valley, Golden Cove MPM, Lighthouse Isle), sách _Fluid Simulation for Computer Graphics_ (Bridson, 2nd ed.) và các kỹ thuật phổ biến trong game. Mục tiêu: lần sau làm nước, mở file này ra là chọn được hướng đi, có sẵn công thức, tham số khởi đầu và danh sách lỗi cần tránh.

Công thức đều đi kèm giải thích bằng lời. Không cần thuộc toán: chỉ cần hiểu mỗi đại lượng nghĩa là gì và vặn núm nào thì ra hiệu ứng gì.

---

## Mục lục

1. [Chọn phương pháp nào?](#1-chọn-phương-pháp-nào)
2. [Kiến thức nền tối thiểu](#2-kiến-thức-nền-tối-thiểu)
3. [Nhóm A: Mặt nước tính sẵn (không mô phỏng)](#3-nhóm-a-mặt-nước-tính-sẵn-không-mô-phỏng)
4. [Nhóm B: Heightfield 2D, phương trình sóng](#4-nhóm-b-heightfield-2d-phương-trình-sóng)
5. [Nhóm C: Heightfield 2D, nước nông (shallow water)](#5-nhóm-c-heightfield-2d-nước-nông-shallow-water)
6. [Nhóm D: Lưới 3D (Eulerian)](#6-nhóm-d-lưới-3d-eulerian)
7. [Nhóm E: Hạt 3D (SPH, PBF, FLIP, MPM)](#7-nhóm-e-hạt-3d-sph-pbf-flip-mpm)
8. [Vẽ nước (rendering)](#8-vẽ-nước-rendering)
9. [Tương tác với vật thể](#9-tương-tác-với-vật-thể)
10. [Nền tảng và hiệu năng](#10-nền-tảng-và-hiệu-năng)
11. [Danh sách lỗi đã gặp](#11-danh-sách-lỗi-đã-gặp)
12. [Công thức nấu sẵn cho các tình huống game](#12-công-thức-nấu-sẵn-cho-các-tình-huống-game)
13. [Tham khảo](#13-tham-khảo)

---

## 1. Chọn phương pháp nào?

Câu hỏi quan trọng nhất không phải "mô phỏng thế nào cho đúng" mà là **nước trong game cần làm được gì**.

| Nhóm                                      | Cách hoạt động                  | Làm được                                        | Không làm được                                | Chi phí               | Demo trong project                   |
| ----------------------------------------- | ------------------------------- | ----------------------------------------------- | --------------------------------------------- | --------------------- | ------------------------------------ |
| **A. Tính sẵn** (sóng sin, Gerstner, FFT) | Độ cao = hàm của (x, z, t)      | Đại dương vô tận, sóng đẹp, rẻ                  | Không phản ứng với vật, không bị đảo chặn     | Rất rẻ                | Lighthouse Isle                      |
| **B. Phương trình sóng**                  | Lưới 2D lưu độ cao, sóng lan đi | Gợn sóng khi ném đá, sóng phản xạ khỏi thành    | Nước không chảy đi đâu, không tràn lên bờ khô | Rẻ (GPU ping-pong)    | Pool Water Lab, Ao Sen               |
| **C. Nước nông (SWE)**                    | Lưới 2D lưu độ sâu + vận tốc    | Lũ, vỡ đập, sóng leo bờ, nước chảy vòng qua vật | Sóng cuộn, bắn tung toé, thác đổ              | Vừa                   | Shoaling Beach Lab, Dam Break Valley |
| **D. Lưới 3D**                            | Lưới 3D vận tốc + áp suất       | Khói, lửa, nước trong bể kín (với level set)    | Khó làm nước mặt thoáng đẹp ở thời gian thực  | Đắt                   | Flame Lab                            |
| **E. Hạt 3D** (SPH, PBF, MPM)             | Hàng chục nghìn hạt mang nước   | Sóng vỡ, bắn nước, đổ nước, thác                | Vùng nước lớn (giới hạn số hạt)               | Đắt (cần GPU compute) | Golden Cove MPM                      |

**Quy tắc chọn nhanh:**

- Biển hoặc hồ lớn làm phông nền → **A**.
- Mặt nước nhỏ cần gợn khi có vật chạm (ao, bể bơi, vũng nước) → **B**, thường chồng thêm **A** cho sóng nền.
- Nước cần **chảy** (lũ, thuỷ triều lên bãi, vỡ đập, kênh dẫn nước) → **C**.
- Cảnh "khoe" nước: rót cốc nước, sóng đập đá, thác nhỏ → **E**, trong một hộp nhỏ.
- Game thường **kết hợp**: A cho biển xa, B hoặc C quanh người chơi, E cho hiệu ứng cục bộ, và hạt trang trí (spray, bọt) để che chỗ nối.

Một nguyên tắc nữa: **phần lớn vẻ đẹp của nước đến từ rendering**, không phải từ mô phỏng. Lighthouse Isle không mô phỏng gì cả mà vẫn trông sống động, vì có màu theo độ sâu, bọt viền và tia nước. Nên đầu tư rendering (mục 8) trước khi nâng cấp mô phỏng.

---

## 2. Kiến thức nền tối thiểu

### 2.1 Phương trình Navier–Stokes, nói bằng lời

Mọi phương pháp đều là cách giải gần đúng của hai luật này (Bridson ch.1):

1. **Động lượng:** gia tốc của một giọt nước = trọng lực + lực đẩy do chênh lệch áp suất + ma sát nội (nhớt).

   ```
   ∂u/∂t + (u·∇)u = −(1/ρ)∇p + g + ν∇²u
   ```
   - `(u·∇)u` là **advection**: nước mang theo vận tốc của chính nó đi.
   - `−∇p/ρ`: nước bị đẩy từ chỗ áp suất cao sang chỗ thấp.
   - `ν∇²u`: độ nhớt. Với nước thường bỏ qua được (Bridson §1.5); sai số số học của bộ giải đã đủ "nhớt".

2. **Không nén được:** lượng nước chảy vào một ô bằng lượng chảy ra.
   ```
   ∇·u = 0
   ```

### 2.2 Hai góc nhìn

- **Euler (lưới):** đứng yên một chỗ, đo nước chảy qua. Ví dụ: lưới 2D của SWE, lưới 3D của khói.
- **Lagrange (hạt):** đi theo từng giọt nước. Ví dụ: SPH, PBF.
- **Lai:** FLIP, APIC, MPM dùng hạt để _mang_ nước và lưới để _tính lực_. Đây là hướng mạnh nhất hiện nay (MPM trong Golden Cove).

### 2.3 Tách bước (splitting)

Không giải cả phương trình một lúc mà chia mỗi bước thời gian thành các bước nhỏ (Bridson ch.2):

```
1. advect   – di chuyển các đại lượng theo dòng chảy
2. lực ngoài – cộng trọng lực, gió, vật đẩy
3. project  – sửa vận tốc cho không nén được (giải áp suất)
```

### 2.4 Bước thời gian và CFL

**Quy tắc vàng:** trong một bước, không có gì được đi xa quá một ô lưới.

```
Δt ≤ C · Δx / v_max        (C ≈ 0.2–1)
```

- Với sóng: `v_max` là **tốc độ sóng**, không phải tốc độ nước. Nước nông: `c = √(g·d)`.
- Với hạt nén được (SPH, MPM): `v_max` là **tốc độ âm thanh giả** `c_s`, thường lớn nhất.
- Nổ số (NaN, giá trị bay lên vô cùng) gần như luôn là do vi phạm CFL. Cách chữa: chia nhỏ bước (substep) thay vì giảm Δt toàn cục.

Các con số thực tế đã dùng:

| Demo                   | Δx         | Công thức Δt                                       |
| ---------------------- | ---------- | -------------------------------------------------- |
| Pool Water Lab (sóng)  | 1 texel    | substep sao cho `c·Δt/Δx ≤ 0.5`                    |
| Dam Break Valley (SWE) | 0.05 m     | `0.2·Δx/√(g·max(d))`, tối đa 12 bước/khung         |
| Golden Cove (MPM)      | 0.2–0.33 m | `(1/60)/substeps`, substeps 5–7, `c_s·Δt ≈ 0.33Δx` |

### 2.5 Tán sắc: vì sao sóng dài chạy nhanh

Quan hệ giữa tần số `ω` và số sóng `k = 2π/L`:

```
ω² = g·k·tanh(k·d)
```

- **Nước sâu** (d lớn): `ω = √(g·k)`, tốc độ `c = √(g/k)`. Sóng dài chạy nhanh hơn sóng ngắn.
- **Nước nông** (d nhỏ): `c = √(g·d)`. Mọi sóng chạy cùng tốc độ, chậm lại khi vào bờ. Đó là lý do sóng **dồn cao và vỡ** ở chỗ nông (shoaling).

Đây là công thức đáng nhớ nhất. Dùng nó cho sóng tính sẵn (mục 3), để kiểm tra mô phỏng, và để giải phương trình `k` từ chu kỳ `T` cho máy tạo sóng (piston) ở mục 9.

---

## 3. Nhóm A: Mặt nước tính sẵn (không mô phỏng)

### 3.1 Tổng các sóng sin

```
y(x, z, t) = Σ Aᵢ · sin(kᵢ (dᵢ·p) − ωᵢ t + φᵢ)
```

Đơn giản nhưng đỉnh sóng tròn như bụng sóng, trông "mềm".

### 3.2 Sóng Gerstner (sóng trochoid)

Dịch mỗi điểm cả **ngang** lẫn **dọc** nên đỉnh nhọn, bụng bẹt, đúng dáng sóng biển:

```
f = k (d · p − c t),     k = 2π/L,   c = √(g/k)
x += Q·A·dₓ·cos f
z += Q·A·d_z·cos f
y += A·sin f
```

| Tham số | Ý nghĩa                       | Gợi ý                                                                         |
| ------- | ----------------------------- | ----------------------------------------------------------------------------- |
| `L`     | Bước sóng                     | Sóng chính 20–40 m, sóng phụ 5–15 m                                           |
| `A`     | Biên độ                       | Giữ `A/L` < 1/7                                                               |
| `Q`     | Độ dốc, 0 = sin, 1 = rất nhọn | 0.3–0.6. Tổng `Qᵢ·kᵢ·Aᵢ` phải < 1, nếu không mặt nước tự cắt (vòng lặp ngược) |
| `d`     | Hướng                         | Lệch nhau ±0.5–1.2 rad quanh hướng gió                                        |

Bộ 4 sóng dùng trong Lighthouse Isle (góc lệch so với gió, L, Q, A):

```js
;[
	[0.0, 30, 0.55, 0.85],
	[0.5, 17, 0.5, 0.45],
	[-0.6, 11, 0.45, 0.28],
	[1.25, 6.5, 0.3, 0.12],
]
```

**Pháp tuyến giải tích:** cộng đạo hàm của từng sóng vào hai vector tiếp tuyến rồi lấy tích có hướng. Đã có code đầy đủ trong `lighthouse-isle-tutorial.md` phần 7.

**Mẹo:**

- Viết **cùng một hàm** bằng GLSL (để vẽ) và JS (để phao nổi, tia nước, va chạm). Hai bên phải dùng chung tham số và chung đồng hồ thời gian.
- Trong hộp hoặc vùng có biên, **tắt dịch ngang gần mép** (`edge = smoothstep(...)`), nếu không mép mesh bị kéo lệch.
- Muốn có "đợt sóng lớn": cộng một gò Gauss chạy ngang: `A·exp(−((d·p − x₀ − v·t)/W)²)`.

### 3.3 Đại dương FFT (Tessendorf)

Đây là cách mà phim và game AAA làm biển (Bridson ch.13):

1. Tạo phổ sóng ngẫu nhiên `h₀(k)` theo phổ thống kê (Phillips, JONSWAP) quyết định bởi tốc độ gió.
2. Mỗi khung, quay pha của từng thành phần: `h(k, t) = h₀(k)·e^{iωt} + conj(h₀(−k))·e^{−iωt}`, với `ω = √(g|k|)`.
3. Inverse FFT ra lưới độ cao (thường 256²), lặp lại liền mạch theo chu kỳ không gian.
4. Thêm dịch ngang ("choppy") bằng FFT của `−i·k/|k|·h`.

Ưu điểm: hàng nghìn sóng với chi phí cố định. Nhược điểm: thấy lặp lại khi nhìn xa. Chữa bằng cách chồng 2–3 lớp FFT với kích thước khác nhau (Bridson §13.6). Trên web: dùng ping-pong FFT trong fragment shader (WebGL2) hoặc compute shader (WebGPU).

---

## 4. Nhóm B: Heightfield 2D, phương trình sóng

### 4.1 Phương trình

Bridson §12.2:

```
∂²h/∂t² = c² ∇²h,      c² = g·d
```

Nói dễ hiểu: **mặt nước bị kéo về phía trung bình của các ô hàng xóm**. Ô nào cao hơn hàng xóm thì bị kéo xuống, thấp hơn thì bị đẩy lên. Thế là sóng lan đi.

### 4.2 Code rời rạc (Verlet, 2 bộ đệm)

```glsl
// mỗi texel: (h_hiện_tại, h_trước)
float lap = hL + hR + hD + hU - 4.0*h;            // Laplacian = "lệch so với hàng xóm"
float hNew = 2.0*h - hPrev + (c*c*dt*dt/(dx*dx)) * lap;
hNew *= damping;                                   // 0.995–0.999: sóng tắt dần
```

- **Điều kiện ổn định:** `c·Δt/Δx ≤ 1/√2` (2D). Dùng ≤ 0.5 cho an toàn.
- **Thả đá:** cộng một gò Gauss âm vào `h` (`addDrop`).
- **Thành bể:** đặt `h` ở ô ngoài biên bằng ô trong biên (sóng phản xạ), hoặc làm tắt dần trong một dải sát biên (sóng thoát ra).
- **Vật cản:** ô nằm trong vật thì gán `h = 0` cố định, sóng sẽ vòng qua (nhiễu xạ).

### 4.3 Chạy trên GPU (WebGL)

Ping-pong hai render target float (`HalfFloatType` là đủ). Mỗi bước vẽ một quad toàn màn hình đọc RT A, ghi RT B rồi đổi vai. Lưới 256² chạy nhiều substep mỗi khung vẫn nhẹ (Pool Water Lab).

### 4.4 Mẹo thực tế

- **Độ sâu hiệu dụng:** với ao nhỏ, dùng `d` thật thì sóng chạy quá nhanh. Ao Sen dùng `C² = 9.81·depth·0.18` cho tốc độ gợn trông đúng cỡ ao.
- **Tốc độ theo vùng:** cho `c²` thay đổi theo ô (`c² = g·d(x,z)`) thì sóng tự chậm lại chỗ nông. Nhưng đây vẫn là sóng tuyến tính: không vỡ, không leo bờ.
- **Kết hợp nhóm A:** cộng Gerstner làm sóng nền, còn lưới chỉ lo phần gợn do tương tác.

---

## 5. Nhóm C: Heightfield 2D, nước nông (shallow water)

### 5.1 Khi nào cần

Khi nước phải **di chuyển thật**: lũ tràn vào thung lũng, nước leo lên bãi cát rồi rút, nước chảy vòng qua cột cầu. Phương trình sóng không làm được, vì nó không có khái niệm "ô khô trở nên ướt" (thử bật chế độ §12.2 trong Dam Break Valley sẽ thấy đập vỡ mà nước đứng yên).

### 5.2 Đại lượng trên lưới MAC (so le)

Bridson §12.3:

| Đại lượng   | Vị trí          | Ý nghĩa               |
| ----------- | --------------- | --------------------- |
| `d`         | tâm ô           | Độ sâu nước           |
| `b`         | tâm ô           | Cao độ đáy (địa hình) |
| `h = b + d` | tâm ô           | Cao độ mặt nước       |
| `u`         | mặt trái/phải ô | Vận tốc theo x        |
| `w`         | mặt trước/sau ô | Vận tốc theo z        |

Đặt vận tốc ở mặt ô (lưới so le) thì đạo hàm áp suất và độ phân kỳ được tính chính xác hơn và tránh dao động "bàn cờ".

### 5.3 Một bước

```
1. Advect u, w, d (semi-Lagrangian: lần ngược theo vận tốc, lấy mẫu nội suy)
2. h = b + d; ngoại suy h vào ô khô
3. u -= Δt · g · (h[i] − h[i−1]) / Δx        (tương tự cho w)
4. d -= Δt · d · (∇·u)
5. Ma sát đáy: u *= 1 / (1 + Δt · C_f · |u| / d)
```

Δt: `0.2 · Δx / √(g · d_max)`.

### 5.4 Ướt và khô

Đây là phần khó nhất của SWE:

- Ngưỡng ướt: ô có `d > ε` (ε ≈ 4e-4 m) mới coi là có nước.
- **Ngoại suy `h`, không ngoại suy `d`** vào ô khô (Bridson). Nhờ vậy nước nằm yên trên dốc không tự trôi.
- **Lỗi mình gặp:** làm đúng như sách thì nước đứng sát một ô khô _thấp hơn_ cũng không bao giờ tràn sang (vỡ đập mà nước đứng im). **Sửa:** ô khô có đáy thấp hơn mặt nước bên cạnh thì lấy `h = b` của chính nó để nước chảy được; ô khô cao hơn thì giữ giá trị ngoại suy.
- Kẹp vận tốc (±6 m/s) để chặn nổ số ở mép nước mỏng.

### 5.5 Điều kiện biên

Bridson §12.1.4:

- **Tường:** vận tốc vuông góc thành = 0, sóng dội lại.
- **Biên mở:** copy vận tốc từ ô bên trong ra (`u[biên] = max(0, u[biên−1])`), kèm một **vùng xốp** (sponge) khoảng 14 ô để làm dịu sóng trước khi thoát ra.
- **Máy tạo sóng:** một piston đẩy (đặt `u` ở mép bằng vận tốc piston), xem 9.3.

### 5.6 Kiểm tra bằng lời giải giải tích

Bài toán vỡ đập trên nền khô (Ritter) là phép thử chuẩn cho SWE:

```
c₀ = √(g·h₀)
h(x, t) = (2c₀ − ξ)² / (9g)   với  −c₀ ≤ ξ = (x − x_đập)/t ≤ 2c₀
độ sâu ngay tại đập = 4h₀/9;   đầu lũ chạy với tốc độ 2c₀
```

Dam Break Valley so độ sâu tại đập với `4h₀/9` (khớp trong khoảng 10%). Đầu lũ trong mô phỏng chậm hơn lý thuyết vì có ma sát và vì lưới không biểu diễn được mũi nước mỏng.

### 5.7 Hạn chế cố hữu

Một điểm (x, z) chỉ có **một** độ cao. Vì vậy SWE không cuộn sóng, không bắn tung toé, không có thác. Che bằng hạt trang trí: tung hạt bọt ở chỗ vận tốc lớn hoặc độ dốc mặt nước lớn.

---

## 6. Nhóm D: Lưới 3D (Eulerian)

Dùng nhiều cho **khói và lửa**. Với nước mặt thoáng thì cần thêm level set hoặc hạt đánh dấu.

### 6.1 Vòng lặp chuẩn ("Stable Fluids")

```
1. advect vận tốc và các đại lượng (nhiệt độ T, khói s, nhiên liệu...)  – semi-Lagrangian
2. lực: buoyancy  f_y = −α·s + β·(T − T_môi_trường)
        vorticity confinement (giữ lại các xoáy nhỏ bị mất do sai số)
3. divergence: div = ∇·u
4. giải áp suất ∇²p = div/Δt   (Jacobi 20–40 vòng, hoặc PCG/multigrid)
5. trừ gradient: u −= Δt·∇p
```

Bridson ch.3 (advection), ch.5 (áp suất), ch.6 (khói), ch.11 (xoáy).

### 6.2 Semi-Lagrangian advection

"Giá trị mới ở ô này = giá trị cũ ở chỗ mà nước từ đó chảy tới đây":

```glsl
vec3 back = pos - dt * velocity(pos);   // lần ngược
q_new = sample_trilinear(q_old, back);
```

Luôn ổn định nhưng làm mờ chi tiết. Cải thiện bằng MacCormack/BFECC, nội suy bậc ba, hoặc chuyển sang hạt (FLIP, APIC).

### 6.3 Lửa (Bridson ch.9)

- **Thin flame:** level set `φ` lan với tốc độ cháy `S`, khí nở ra ở mặt lửa.
- **Volumetric combustion:** nhiên liệu `F` cháy khi `T > T_cháy`. Lượng cháy `ΔF = min(F, z·Δt)` sinh nhiệt, khói và độ nở thể tích (divergence dương).
- Nguội theo bức xạ: `dT/dt = −c·((T − Ta)/(Tm − Ta))⁴`.
- Màu: vật đen (black-body) theo nhiệt độ, lõi xanh ở vùng phản ứng.

### 6.4 Trên web

Lưu lưới 3D thành **atlas 2D** (các lát z xếp cạnh nhau trên một texture). Mỗi bước là một pass fullscreen. Flame Lab dùng 48×80×48 với 28 vòng Jacobi. Vẽ bằng ray-march xuyên qua atlas.

Muốn nước mặt thoáng thì phải thêm level set, tái khởi tạo khoảng cách, ngoại suy vận tốc... Ở thời gian thực, hạt (nhóm E) thường dễ hơn.

---

## 7. Nhóm E: Hạt 3D (SPH, PBF, FLIP, MPM)

### 7.1 So sánh nhanh

| Phương pháp                     | Ý tưởng                                                | Ưu                                        | Nhược                                          |
| ------------------------------- | ------------------------------------------------------ | ----------------------------------------- | ---------------------------------------------- |
| **SPH**                         | Mật độ = tổng trọng số hạt hàng xóm, áp suất từ mật độ | Đơn giản                                  | Cần tìm hàng xóm; nén nhiều nếu không làm cứng |
| **PBF** (Position Based Fluids) | Ràng buộc mật độ, chiếu vị trí lặp nhiều vòng          | Ổn định với bước lớn, hay dùng trong game | Hơi "dẻo", cần tìm hàng xóm                    |
| **FLIP/PIC**                    | Hạt mang vận tốc, lưới giải áp suất                    | Chuẩn VFX, nước rất "sống" (Bridson ch.7) | Cần bộ giải áp suất, nhiễu hạt                 |
| **APIC**                        | Như PIC nhưng hạt mang thêm ma trận `C`                | Giữ xoáy, ít nhiễu hơn FLIP               | Bộ nhớ hạt lớn hơn                             |
| **MLS-MPM**                     | APIC + ứng suất tính trên lưới, không cần giải áp suất | Không cần tìm hàng xóm, rất hợp GPU       | Nước hơi nén được                              |

### 7.2 MLS-MPM: công thức đã chạy trong Golden Cove

**Hạt** lưu: vị trí, vận tốc `v`, ma trận affine `C` (3×3), mật độ, độ bọt. Khoảng 80 byte mỗi hạt.
**Lưới**: mỗi nút có `(m·vx, m·vy, m·vz, m)` dạng **số nguyên atomic** (fixed-point ×1e5), vì nhiều hạt cộng vào cùng nút một lúc.

Mỗi substep có 5 kernel compute:

```
1. clearGrid    : xoá lưới
2. P2G-1        : mỗi hạt rải khối lượng và động lượng APIC  m·(v + C·d)  lên 27 nút
                  (trọng số B-spline bậc 2: w = 0.5(0.5−d)², 0.75−d², 0.5(0.5+d)²)
3. P2G-2        : hạt đọc lại mật độ ρ = Σ w·m_nút
                  áp suất Tait  p = K·((ρ/ρ₀)⁵ − 1),  kẹp p ≥ 0
                  ứng suất σ = −p·I + μ(C + Cᵀ)
                  rải động lượng  −Δt · (1/ρ) · 4 · σ · d · w  lên 27 nút
4. updateGrid   : v = động lượng / khối lượng; cộng trọng lực;
                  va chạm với vật rắn bằng SDF (bỏ thành phần vận tốc đâm vào);
                  tường hộp; piston tạo sóng
5. G2P          : hạt lấy v và C mới từ lưới (C = 4·Σ w·v·dᵀ), di chuyển,
                  đẩy ra khỏi vật rắn, tính bọt
```

**Tham số khởi đầu đã chạy tốt** (đơn vị lưới, thời gian tính bằng giây):

| Tham số               | Giá trị                         | Ghi chú                                                            |
| --------------------- | ------------------------------- | ------------------------------------------------------------------ |
| `ρ₀`                  | 4 hạt/ô                         | Rải hạt cách nhau `ρ₀^(−1/3) ≈ 0.63` ô, có xê dịch ngẫu nhiên ±0.2 |
| `c_s` (tốc độ âm giả) | 75–125 ô/s                      | Khoảng 6 lần tốc độ sóng. `K = c_s²·ρ₀/5`                          |
| Δt                    | `(1/60)/substeps`, 5–7 substeps | `c_s·Δt ≈ 0.33` ô                                                  |
| `g`                   | `9.81/Δx` ô/s²                  |                                                                    |
| Độ nhớt μ             | 0.1                             |                                                                    |
| Ma sát đáy            | **≈ 0.02**                      | Xem lỗi số 1 ở mục 11                                              |
| Kẹp vận tốc           | 8 m/s                           |                                                                    |

**Mẹo quan trọng:**

- **Rải hạt dày hơn mực nước mong muốn khoảng 1 ô.** Lớp hạt ở mặt và sát đáy thiếu hàng xóm nên sẽ lún xuống, nước tụt khoảng một ô sau giây đầu. Sau đó đo mực nước thật rồi chỉnh các phần trang trí (biển ngoài, cát ướt) theo mực này.
- **Bọt:** tăng khi hạt chạy nhanh (> 2 m/s) hoặc bị bắn rời (mật độ < 0.55ρ₀ _và_ đang chuyển động). Giảm dần với thời gian sống khoảng 3 s.
- **Dữ liệu theo cột:** đếm số hạt trong mỗi cột (x, z) để suy ra độ sâu `count/ρ₀·Δx`. Dùng cho cát ướt và caustics. Đừng dùng "hạt cao nhất trong cột", vì một giọt bắn lên sẽ làm sai độ sâu.

### 7.3 Đưa dữ liệu hạt sang Three.js không cần copy về CPU

Với `WebGPURenderer`, tạo `GPUBuffer` của riêng bạn rồi gán cho attribute trước khi three dùng nó:

```js
const attr = new THREE.StorageInstancedBufferAttribute(new Float32Array(N * 4), 4)
renderer.backend.get(attr).buffer = myGPUBuffer // three dùng lại buffer có sẵn
// trong TSL: storage(attr, 'vec4', N).toReadOnly().element(instanceIndex)
```

Compute shader viết bằng WGSL thuần, chạy trên `renderer.backend.device`, nộp vào cùng hàng đợi trước khi render nên thứ tự luôn đúng. Lưu ý: đây là API nội bộ của three, nên ghim phiên bản (đã dùng `three@0.184.0`).

---

## 8. Vẽ nước (rendering)

### 8.1 Kiến trúc hai lượt

Shader nước cần biết **phía sau mặt nước có gì** và **cách bao xa**:

```
Lượt 1: vẽ cảnh KHÔNG có nước vào render target  →  tColor + tDepth
Lượt 2: vẽ lại cảnh + mặt nước; nước đọc tColor, tDepth
```

Mặt nước tự trộn màu nền nên vẽ **đục** (không blending). Cách này tránh mọi rắc rối về thứ tự vật trong suốt.

### 8.2 Độ dày nước từ depth

```glsl
float z  = -perspectiveDepthToViewZ(texture(tDepth, uv).r, near, far); // theo trục camera
float sd = z / dot(rayDir, camForward);       // đổi sang độ dài dọc tia nhìn (bước hay quên!)
float wd = length(waterPos - camPos);
float thick  = max(sd - wd, 0.0);             // tia sáng đi trong nước bao xa
float vdepth = thick * max(-rayDir.y, 0.08);  // độ sâu thẳng đứng, dùng cho bọt
```

### 8.3 Hấp thụ (định luật Beer–Lambert)

Ánh sáng qua nước bị hấp thụ theo hàm mũ, mỗi màu một hệ số khác nhau. Đỏ mất nhanh nhất, nên nước sâu ngả xanh:

```glsl
vec3 trans = exp(-sigma * path);                 // sigma cho nước nhiệt đới ≈ (0.46, 0.09, 0.07) /m
vec3 scat  = waterColor * (1.0 - exp(-0.5 * path));
vec3 col   = bg * trans + scat;
```

- **Nhìn xiên** làm `path` rất dài, cả vùng xa thành một màu. Chữa: trộn quãng tia nhìn với độ sâu thẳng đứng (`mix(path, vdepth*1.8, 0.55)`).
- **Kiểu stylized:** thay hàm mũ bằng nội suy 2–3 màu (nông, giữa, sâu) theo `t = 1 − exp(−path·k)`, rồi phân bậc.

### 8.4 Khúc xạ màn hình

```glsl
vec2 ruv = uv + normal.xz * 0.03 * clamp(thick * 0.12, 0.0, 1.0);
if (sceneDist(ruv) < waterDist) ruv = uv;   // BẮT BUỘC: không kéo vật phía trước vào nước
```

### 8.5 Fresnel và phản chiếu

```glsl
float F = 0.02 + 0.98 * pow(1.0 - max(dot(-rd, n), 0.0), 5.0);   // Schlick, F0 của nước = 0.02
vec3 refl = sky(reflect(rd, n));
col = mix(col, refl, F);
```

Nhìn thẳng xuống thì trong, nhìn xa ở góc nghiêng thì như gương. Nếu tia phản xạ chĩa xuống dưới đường chân trời (ở mép sóng), dùng màu nền thay vì màu trời tối, nếu không mép sóng sẽ có viền đen.

### 8.6 Caustics (vân sáng dưới đáy)

| Cách                                                                                            | Chính xác           | Chi phí         | Dùng ở                       |
| ----------------------------------------------------------------------------------------------- | ------------------- | --------------- | ---------------------------- |
| **Tỉ lệ diện tích:** khúc xạ một lưới tia sáng qua mặt nước, so diện tích tam giác trước và sau | Đúng theo sóng thật | Một pass render | Pool Water Lab               |
| **Voronoi F2 − F1:** nhiễu động theo thời gian                                                  | Giả, nhưng đẹp      | Rất rẻ          | Lighthouse Isle, Golden Cove |

Voronoi:

```glsl
// sáng ở đường biên giữa các ô; cộng 2 lớp khác tỉ lệ để bớt lặp
return 1.0 - smoothstep(0.0, 0.12, sqrt(F2) - sqrt(F1));
```

Nhân với `exp(−depth·k)` và mờ dần sát mặt nước. Chèn vào vật liệu có sẵn bằng `onBeforeCompile` (trước `#include <dithering_fragment>`).

### 8.7 Bọt

| Loại                | Cách tính                                                                      | Ghi chú                                                 |
| ------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------- |
| **Viền va chạm**    | `1 − smoothstep(0, w + noise, vdepth)`                                         | Tự có quanh mọi vật nhờ depth, không cần biết vật ở đâu |
| **Vệt bọt thứ hai** | So `vdepth` với một giá trị dao động theo `sin(t)`                             | Cảm giác bọt vỗ ra vỗ vào                               |
| **Đỉnh sóng**       | `smoothstep` trên độ cao chuẩn hoá × dải nhiễu                                 | Ngưỡng cao (0.72–0.86), nếu thấp sẽ thành mảng trắng to |
| **Theo mô phỏng**   | Lưu "độ bọt" trên hạt hoặc ô, tăng khi nhanh hoặc va chạm, giảm theo thời gian | Golden Cove                                             |
| **Hạt bắn (spray)** | Hệ hạt CPU, phát khi đỉnh sóng _vừa vượt_ ngưỡng tại điểm bờ đón gió           | Xem 9.4                                                 |

### 8.8 Vẽ chất lỏng từ hạt (Screen-Space Fluid Rendering)

Dùng cho nhóm E:

```
1. Vẽ mỗi hạt thành quả cầu nhỏ, ghi độ sâu mặt cầu  → RT độ sâu (R32F)
2. Vẽ hạt cộng dồn độ dày                          → RT độ dày (RGBA16F, additive)
3. Làm mượt độ sâu: bilateral 13 tap, ngang rồi dọc, 2–3 lần
4. Dựng vị trí và pháp tuyến từ độ sâu đã mượt
5. Tô: khúc xạ, hấp thụ theo độ dày, Fresnel, bọt
```

Lưu ý:

- Hiệu chỉnh độ dày: chia cho `ρ₀ · (4/3)π · (r/Δx)³` để tổng độ dày bằng quãng đường thật trong nước.
- Ngưỡng bilateral tỉ lệ theo khoảng cách: `tol = max(base, d₀·0.06)`. Nếu không, nhìn xiên sẽ ra các sọc ngang.
- Lấy pháp tuyến với khoảng cách 2 texel; chọn phía có độ chênh nhỏ hơn để tránh viền ở mép.
- Hạt xếp lưới đều nhìn xiên ra sọc: xê dịch ngẫu nhiên vị trí ban đầu khoảng 0.4 khoảng cách hạt.
- Nước mỏng (bãi bồi, vũng): ép pháp tuyến về hướng lên và cho alpha giảm theo độ dày.

### 8.9 Dưới nước

- **Cửa sổ Snell:** nhìn từ dưới lên, chỉ thấy bầu trời trong một hình nón khoảng 97°. Ngoài nón đó mặt nước phản xạ toàn phần, thấy màu đáy.
- Sương mù màu nước theo khoảng cách, tia sáng (god rays), bọt và hạt lơ lửng (Pool Water Lab).

### 8.10 Kiểu stylized (toon)

- Phân bậc màu: `(floor(t·N) + smoothstep(0.4, 0.6, fract(t·N))) / N`. Mềm hơn `floor` cứng nên không răng cưa.
- Đốm nắng: `step(0.45, spec + noise·0.35)` cho ra các đốm lấp lánh rời rạc.
- Bọt `step` cứng màu trắng, viền Fresnel cắt gọn.
- Không dùng tone mapping (ACES làm lệch màu đã chọn).
- Mặt cắt hộp: tường nước có mép trên bám theo hàm sóng, màu theo độ sâu dưới mặt nước.

---

## 9. Tương tác với vật thể

### 9.1 Vật nổi (phao, thuyền)

Dùng hàm độ cao bản JS:

```js
const h = waveHeight(x, z, t)
const hx = waveHeight(x + 1, z, t) - h,
	hz = waveHeight(x, z + 1, t) - h
obj.position.y = h - draft // draft: phần chìm
obj.rotation.set(hz * 0.6, 0, -hx * 0.6)
```

Muốn có quán tính: dùng lò xo giảm chấn hướng về `h` thay vì gán thẳng.

**Lực nổi đúng hơn:** lấy mẫu vài điểm dưới thân vật. Điểm nào nằm dưới mặt nước thì cộng lực `ρ·g·V_chìm` hướng lên và lực cản ngược hướng chuyển động.

### 9.2 Vật đẩy nước (one-way coupling)

Bridson §15.1:

- **Heightfield:** vật đi qua thì trừ thể tích của nó khỏi `h` ở các ô bị chiếm, hoặc cộng gò âm. Nước bị đẩy dồn ra xung quanh thành sóng (quả phao trong Pool Water Lab).
- **SWE:** đặt vận tốc ở các ô có vật bằng vận tốc vật.
- **MPM:** trong `updateGrid`, nút nằm trong vật thì đặt vận tốc nút bằng vận tốc vật. Piston tạo sóng chính là trường hợp này.

### 9.3 Máy tạo sóng (piston)

Piston dao động `X(t) = A·sin(ωt)` tạo sóng cao `H`:

```
H / S = 2(cosh 2kd − 1) / (sinh 2kd + 2kd)      (S = 2A là hành trình)
k giải từ ω² = g·k·tanh(k·d) bằng lặp:  k ← ω² / (g·tanh(k·d)), 40 vòng
```

Tăng biên độ từ từ trong khoảng 6 s đầu để không tạo cú sốc ban đầu. Cộng thêm một sóng phụ nhỏ (×0.14, tần số ×1.13) thì sóng không đều đặn như máy.

### 9.4 Tia nước khi sóng đập vào

```js
// mỗi điểm phát quanh bờ có: vị trí, pháp tuyến hướng ra ngoài, h trước đó, thời gian nghỉ
if (h > thr && prev <= thr && cool <= 0 && facing > -0.15) { burst(...); cool = 0.5; }
```

- Kiểm tra **vừa vượt ngưỡng** (`prev ≤ thr < h`) để mỗi con sóng chỉ gây một cú bắn.
- `facing = −dot(pháp_tuyến, hướng_gió)`: phía đón gió bắn mạnh hơn.
- Tìm đường bờ bằng **chia đôi** trên hàm địa hình: với mỗi hướng, tìm bán kính tại đó độ cao đáy bằng 0.
- Hạt chết khi rơi xuống dưới mặt nước. Gọi hàm sóng JS để biết mặt nước ở đâu.

---

## 10. Nền tảng và hiệu năng

### 10.1 WebGL2 hay WebGPU

|                        | WebGL2                        | WebGPU                                    |
| ---------------------- | ----------------------------- | ----------------------------------------- |
| Mô phỏng lưới          | Fragment shader ping-pong, ổn | Compute shader, gọn hơn                   |
| Mô phỏng hạt (scatter) | Rất khó (không có atomic)     | Có atomic, MPM chạy thẳng                 |
| Đọc depth của cảnh     | `DepthTexture`                | `DepthTexture`                            |
| Hỗ trợ trình duyệt     | Mọi nơi                       | Chrome/Edge 113+, Safari 26+, Firefox mới |
| Three.js               | `ShaderMaterial` + GLSL       | `WebGPURenderer` + TSL (hoặc WGSL thuần)  |

Nếu cần chạy mọi nơi thì dùng WebGL2 với nhóm A/B/C. Nếu cần hạt 3D thì dùng WebGPU, và chuẩn bị một thông báo rõ ràng khi trình duyệt không có.

### 10.2 Ngân sách tham khảo

| Kỹ thuật               | Cỡ đã dùng               | Chạy ở đâu           |
| ---------------------- | ------------------------ | -------------------- |
| Phương trình sóng      | 256², nhiều substep      | GPU (WebGL)          |
| Phương trình sóng (ao) | 128²                     | CPU                  |
| SWE                    | 160×80 đến 192×64        | CPU (~2 ms/bước)     |
| Khói và lửa 3D         | 48×80×48, 28 vòng Jacobi | GPU (WebGL atlas)    |
| MLS-MPM                | 17k / 40k / ~80k hạt     | GPU (WebGPU compute) |
| Mặt nước Gerstner      | lưới 280²                | GPU vertex shader    |

### 10.3 Mẹo hiệu năng

- **Substep** cho mô phỏng; giới hạn số bước mỗi khung (ví dụ ≤ 12) để máy yếu không đứng hình.
- Mô phỏng ở độ phân giải thấp, rendering ở độ phân giải cao. Pass hạt SSFR có thể chạy ở 0.5–0.75 độ phân giải màn hình.
- Chặn `dt ≤ 0.05 s` để khi tab bị ẩn rồi quay lại, mô phỏng không nhảy một bước khổng lồ.
- CPU: dùng `Float32Array` một chiều với chỉ số `i + nx*j`. Thay backtrace RK2 bằng Euler khi cần nhanh gấp đôi.
- Đưa lên GPU bằng `DataTexture` mỗi khung chỉ hợp lý với lưới vài trăm nghìn ô.

### 10.4 Kiểm thử không có GPU thật

- Kiểm tra số học bằng Node (không vẽ): không NaN, thể tích bảo toàn, so với lời giải giải tích.
- Chromium ẩn với SwiftShader chạy được cả WebGL lẫn WebGPU, nhưng WebGPU cần chế độ có cửa sổ (Xvfb) và rất chậm.
- Với WebGPU khi chạy compute không vẽ, phải chờ `queue.onSubmittedWorkDone()` trước khi nộp tiếp. Nếu không, hàng đợi phình to và GPU process bị giết.

---

## 11. Danh sách lỗi đã gặp

| #   | Triệu chứng                                       | Nguyên nhân                                                                               | Cách sửa                                                                      | Demo             |
| --- | ------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------- |
| 1   | Sóng tắt hẳn trước khi tới bờ                     | Ma sát Coulomb kiểu cát (μ = 0.35) đặt lên lớp nước sát đáy, giảm tốc khoảng μ·g mỗi giây | Ma sát đáy cho nước ≈ 0.02                                                    | Golden Cove      |
| 2   | Mực nước tụt so với thiết kế                      | Hạt ở mặt và sát đáy thiếu hàng xóm nên lún                                               | Rải hạt cao hơn 1 ô, đo lại mực nước sau 1.2 s                                | Golden Cove      |
| 3   | Viền cát ở thành hộp, nước như bể bơi             | Khe giữa mặt phẳng biển ngoài và hạt bị kẹp cách tường                                    | Kẹp hạt `[1, N−1.01]` thay vì `[1.5, N−2.5]`; biển ngoài chỉ vẽ ở dải mép     | Golden Cove      |
| 4   | Cát khô có caustics như đang ở dưới nước          | Độ sâu tính từ hạt cao nhất trong cột (giọt bắn lên làm sai)                              | Đếm số hạt trong cột → độ sâu                                                 | Golden Cove      |
| 5   | Mặt nước nhìn xiên có sọc ngang                   | Hạt xếp lưới đều; bilateral filter quá khắt khe theo độ sâu                               | Xê dịch hạt ban đầu, ngưỡng tỉ lệ theo khoảng cách, pháp tuyến 2 texel        | Golden Cove      |
| 6   | Mép vũng nước có viền xanh đen                    | Pháp tuyến ở mép chĩa ngang, phản xạ màu dưới chân trời                                   | Ép pháp tuyến về hướng lên khi nước mỏng; phản xạ dưới chân trời dùng màu nền | Golden Cove      |
| 7   | Vỡ đập mà nước không tràn                         | Ngoại suy `h` vào ô khô thấp hơn chặn dòng chảy                                           | Ô khô thấp hơn thì lấy `h = b`                                                | Dam Break Valley |
| 8   | Phương trình sóng không làm nước tràn lên đất khô | Bản chất mô hình tuyến tính                                                               | Dùng SWE đầy đủ (có advection)                                                | Dam Break Valley |
| 9   | Đỉnh sóng có mảng trắng to như mây                | Ngưỡng bọt đỉnh sóng quá thấp                                                             | Ngưỡng 0.72–0.86 × dải nhiễu                                                  | Lighthouse Isle  |
| 10  | Nửa xa của hộp một màu xanh đậm                   | Hấp thụ chỉ theo quãng tia nhìn                                                           | Trộn với độ sâu thẳng đứng                                                    | Lighthouse Isle  |
| 11  | Chân vật bị "kéo" vào trong nước                  | Khúc xạ lấy mẫu trúng vật phía trước mặt nước                                             | Kiểm tra độ sâu sau khi lệch, sai thì bỏ lệch                                 | Mọi demo         |
| 12  | Mép mesh nước bị lệch, hộp mất góc vuông          | Gerstner dịch ngang ở biên                                                                | Tắt dịch ngang gần mép                                                        | Lighthouse Isle  |
| 13  | Ripple quá nhanh so với cỡ ao                     | Dùng độ sâu thật trong `c² = g·d`                                                         | Hệ số độ sâu hiệu dụng ~0.18                                                  | Ao Sen           |
| 14  | Màu ShaderMaterial bị tối hoặc rực                | Thiếu chuyển linear → sRGB                                                                | `#include <colorspace_fragment>` cuối fragment shader                         | Mọi demo         |
| 15  | WebGPU "device lost" khi kiểm thử                 | Nộp compute liên tục không chờ GPU                                                        | Chờ `onSubmittedWorkDone()` khi không có khung hình                           | Golden Cove      |

---

## 12. Công thức nấu sẵn cho các tình huống game

**Đại dương thế giới mở**
FFT ocean (2–3 lớp) hoặc 4–8 sóng Gerstner. Màu theo độ sâu từ depth, Fresnel, bọt đỉnh sóng, bọt viền bờ từ depth. Thuyền dùng lực nổi lấy mẫu nhiều điểm.

**Ao, hồ, bể bơi có tương tác**
Phương trình sóng 128²–256² trên GPU, chồng Gerstner nhỏ cho gió. Caustics theo tỉ lệ diện tích (bể bơi) hoặc Voronoi (ao). Vật rơi xuống thì cộng gò âm và tung hạt.

**Bãi biển có sóng vào bờ, thuỷ triều**
SWE trên vùng gần bờ, biên piston hoặc biên mở phía biển, ngoài xa dùng Gerstner. Cát ướt bằng một bản đồ "độ ẩm" giảm dần theo thời gian.

**Lũ, vỡ đập, hệ thống kênh và cửa cống (puzzle game)**
SWE với ướt/khô, ma sát đáy. Kiểm tra bằng Ritter. Che các chỗ nước vỡ bằng hạt bọt.

**Hiệu ứng khoe nước (rót cốc, sóng đập đá, thác nhỏ)**
MLS-MPM trên WebGPU trong hộp nhỏ, vẽ bằng SSFR. Biển ngoài hộp là mặt phẳng có sóng, mực nước khớp theo mực đo được.

**Phong cách hoạt hình, mobile**
Gerstner + toon (phân bậc màu, bọt cứng, đốm nắng). Caustics Voronoi chèn vào vật liệu toon. Tia nước là hạt CPU vài nghìn. Cả cảnh chạy được trên WebGL2.

**Khói, hơi nước, lửa**
Lưới 3D atlas trên WebGL, buoyancy + vorticity confinement, ray-march, màu vật đen.

---

## 13. Tham khảo

### Demo trong project này

| Demo               | Kỹ thuật chính                                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Pool Water Lab     | Phương trình sóng GPU, caustics tỉ lệ diện tích, nhìn dưới nước với cửa sổ Snell, phao đẩy nước                               |
| Shoaling Beach Lab | SWE trên lưới MAC, bãi dốc, piston, biên mở, leo bờ                                                                           |
| Ao Sen             | Phương trình sóng CPU, khúc xạ, cá koi điều khiển bằng steering (Buckland)                                                    |
| Flame Lab          | Lưới 3D atlas, thin flame và volumetric combustion, ray-march                                                                 |
| Dam Break Valley   | SWE với ướt/khô, so sánh với Ritter, biên mở và tường                                                                         |
| Golden Cove MPM    | MLS-MPM WebGPU, SSFR, bọt theo hạt, cát ướt                                                                                   |
| Lighthouse Isle    | Gerstner + toon, nước nhìn xuyên, bọt từ depth, tia nước, mặt cắt hộp. Hướng dẫn chi tiết trong `lighthouse-isle-tutorial.md` |

### Sách _Fluid Simulation for Computer Graphics_ (Bridson, 2nd ed.)

| Chương | Nội dung                                      | Dùng khi                 |
| ------ | --------------------------------------------- | ------------------------ |
| 1–2    | Phương trình chất lỏng, tách bước, lưới       | Nền tảng                 |
| 3      | Advection semi-Lagrangian, giảm khuếch tán số | Mọi bộ giải lưới         |
| 4      | Level set, SDF, ngoại suy dữ liệu             | Mặt nước 3D, va chạm SDF |
| 5      | Áp suất, chiếu không nén được                 | Lưới 3D, FLIP            |
| 6      | Khói, buoyancy                                | Khói, hơi nước           |
| 7      | Phương pháp hạt, PIC/FLIP                     | Nước 3D chất lượng cao   |
| 8      | Nước, kiểm soát thể tích (§8.4)               | Nước 3D mặt thoáng       |
| 9      | Lửa                                           | Lửa                      |
| 11     | Xoáy, vorticity confinement                   | Thêm chi tiết            |
| 12     | Nước nông (§12.2 sóng, §12.3 rời rạc)         | Nhóm B, C                |
| 13     | Mô hình đại dương                             | Nhóm A (FFT)             |
| 15     | Ghép nối chất lỏng và vật rắn (§15.1 one-way) | Vật nổi, vật đẩy nước    |

### Bài báo và tài liệu nên đọc

- Jerry Tessendorf, _Simulating Ocean Water_ (2001): đại dương FFT.
- Jos Stam, _Stable Fluids_ (SIGGRAPH 1999): bộ giải lưới cổ điển.
- Macklin & Müller, _Position Based Fluids_ (2013): chất lỏng hạt cho game.
- Jiang et al., _The Affine Particle-In-Cell Method_ (2015): APIC.
- Hu et al., _A Moving Least Squares Material Point Method_ (2018): MLS-MPM.
- van der Laan et al., _Screen Space Fluid Rendering with Curvature Flow_ (2009): SSFR.
- _GPU Gems 1_, chương 1 "Effective Water Simulation from Physical Models": Gerstner trên GPU.
