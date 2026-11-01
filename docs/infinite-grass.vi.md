# Cỏ được tạo ra như thế nào

_Bản tiếng Anh: [infinite-grass.md](infinite-grass.md)_

Tài liệu này giải thích demo cỏ ở `/games/infinite-grass`, port từ _Quick Grass_ của SimonDev. Mã nguồn nằm trong `src/lib/components/infinite-grass/`.

Ý tưởng cốt lõi: **mỗi lá cỏ được dựng hoàn toàn trong vertex shader**. CPU không lưu vị trí của lá cỏ nào cả. Nó chỉ gửi lên GPU một index buffer nhỏ và yêu cầu vẽ lại 131 072 lần, tất cả trong một draw call.

## Cảnh

Demo vẽ ba vật thể:

| Vật thể  | File                            | Là gì                                                                             |
| -------- | ------------------------------- | --------------------------------------------------------------------------------- |
| Bầu trời | `sky.ts`, `shaders/sky.*`       | Quả cầu bán kính 5 000 m nhìn từ bên trong, tô màu gradient.                      |
| Mặt đất  | `ground.ts`, `shaders/ground.*` | Mặt phẳng 500 × 500 m, chia 512 × 512 ô, được nâng thành đồi trong vertex shader. |
| Cỏ       | `grass.ts`, `shaders/grass.*`   | 131 072 lá cỏ instancing rải trên vùng 100 × 100 m.                               |

`GrassScene` (`grass-scene.ts`) tạo cả ba và giữ các uniform dùng chung (`shared-uniforms.ts`). Uniform dùng chung quan trọng nhất là `terrainParams`: mặt đất và cỏ đọc cùng một hàm địa hình (`shaders/terrain.glsl`), nên gốc mỗi lá cỏ luôn nằm đúng trên mặt đất. Hàm này cũng có bản chạy trên CPU (`terrain.ts`), nên các vật thể three.js thường như quả bóng nhân vật cũng đặt được lên đồi (xem phần 8).

## 1. Lá cỏ không có dữ liệu đỉnh

`grass-geometry.ts` tạo một `InstancedBufferGeometry` **không có attribute nào**: không vị trí, không pháp tuyến, không UV. Nó chỉ có:

- một **index buffer** mô tả các tam giác của một lá, và
- `instanceCount` = số lá cỏ.

Vertex shader suy ra mọi thứ từ hai bộ đếm có sẵn:

- `gl_InstanceID`: đây là lá thứ mấy (0 … bladeCount − 1)
- `gl_VertexID`: đây là góc nào của lá

### Cấu trúc một lá

Một lá là một dải chia thành `segments` đoạn (mặc định 6). Mỗi mốc độ cao có hai đỉnh, trái và phải, nên một mặt có `(segments + 1) × 2` đỉnh:

```
 mốc 3   6 ── 7      ID chẵn = mép trái
         │ ╲  │      ID lẻ   = mép phải
 mốc 2   4 ── 5
         │ ╲  │
 mốc 1   2 ── 3
         │ ╲  │
 mốc 0   0 ── 1      (gốc)
```

Mỗi đoạn là hai tam giác: `(0, 1, 2)` và `(2, 1, 3)`, mỗi mốc dịch lên 2.

Một lá có **hai mặt**. Mặt sau dùng các đỉnh `V … 2V − 1` (V = số đỉnh một mặt) với chiều quấn tam giác đảo ngược, nên nhìn từ phía nào cũng thấy mặt trước. Tổng cộng 12 index mỗi đoạn, 72 cho lá 6 đoạn.

Vì hình dạng phụ thuộc vào `segments`, đổi slider này là thay đổi duy nhất phải dựng lại geometry (`Grass.setParams`). Mọi slider khác chỉ ghi vào uniform.

## 2. Đặt từng lá cỏ

Toàn bộ phần này nằm trong `shaders/grass.vert`.

**Vị trí.** `hash21(gl_InstanceID)` biến số thứ tự instance thành hai số giả ngẫu nhiên trong [0, 1). Đổi sang [−1, 1] rồi nhân với `patchSize` sẽ ra vị trí x/z của lá. Sau đó `terrainHeight()` nâng lá lên đúng độ cao mặt đất tại điểm đó.

**Biến thể của từng lá.** Hash lần hai theo vị trí thế giới của lá cho thêm ba giá trị ngẫu nhiên:

- **Loại cỏ:** khoảng 1 trên 8 lá là loại 1, dùng texture thứ hai và cao gấp 1,5 lần.
- **Hướng xoay:** một góc ngẫu nhiên quanh trục thẳng đứng.
- **Độ nghiêng:** một góc nghiêng ngẫu nhiên từ −0,5 đến 0,5 radian.

Hash theo vị trí thế giới (không theo instance ID) nên lá ở cùng một chỗ luôn trông giống nhau.

**Lối đi từ texture mặt nạ.** `tileData.jpg` là một bản đồ đen trắng trải lên vùng cỏ. Vùng trắng là lối đi. Chiều cao lá được nhân với `1 − tileData`, nên cỏ thấp dần khi tới gần lối đi. Khi kết quả nhỏ hơn 0,25, shader đặt `gl_Position.w = 0`. Mọi đỉnh của lá co về một điểm suy biến, nên GPU bỏ cả lá mà không vẽ.

## 3. Tạo hình lá cỏ

**Giải mã đỉnh.** Từ `gl_VertexID` shader suy ra:

- `xSide`: 0 là mép trái, 1 là mép phải
- `zSide`: −1 là mặt trước, +1 là mặt sau
- `heightPercent`: 0 ở gốc, 1 ở ngọn

**Uốn cong bằng đường Bézier.** Một dải thẳng trông như tờ giấy. Vì vậy lá đi theo một đường Bézier bậc ba với bốn điểm điều khiển:

```
P0 = (0, 0,    0)               gốc
P1 = (0, 0.33, 0)
P2 = (0, 0.66, 0)
P3 = (0, cos(lean), sin(lean))   ngọn, nghiêng theo góc lean
```

Tính đường cong tại `heightPercent` ra độ cao và độ cong về phía trước của từng đỉnh. **Đạo hàm** của đường cong (`bezierGrad`) là hướng dọc theo lá. Xoay nó 90° ra pháp tuyến bề mặt, nên ánh sáng bám theo độ cong.

**Xoay vào vị trí.** Hướng cuối cùng là `rotateAxis(bị đè) × rotateAxis(gió) × rotateY(góc xoay)`, sau đó lá được dời tới vị trí của nó trên địa hình. Phép xoay khi bị đè được giải thích ở phần 8.

## 4. Gió

Gió gồm hai lớp noise, chạy theo `windTime`. CPU cộng dồn giá trị này mỗi frame bằng `delta × windSpeed`, nên kéo slider tốc độ không làm cỏ bị giật.

1. **Cơn gió:** noise tần số thấp trên mặt đất (`xz × 0.05`) trôi theo thời gian. Nó cho sức gió thay đổi mượt trên cả cánh đồng, nên các lá gần nhau ngả cùng nhau như sóng. Lá xoay quanh trục gió một góc `sức gió × windStrength × heightPercent`, nên gốc đứng yên còn ngọn chuyển động nhiều nhất.
2. **Rung lá:** noise tần số cao cho từng lá, chạy nhanh gấp 4, cộng vào góc nghiêng. Nó được nhân với sức gió, nên ở chỗ gió mạnh lá rung nhiều hơn.

## 5. Hai mẹo giúp cỏ trông đúng

**Ánh sáng mịn hơn ở xa.** Ở gần, pháp tuyến cong làm lá trông có khối. Ở xa chúng biến thành nhiễu lấp lánh. Trong khoảng 0 – 10 m tính từ camera, pháp tuyến được trộn dần tới nửa chừng hướng thẳng lên, nên cỏ ở xa được chiếu sáng như một bề mặt mịn.

**Làm dày lá khi nhìn nghiêng.** Một lá phẳng nhìn đúng từ cạnh sẽ thành đường rộng một pixel và biến mất. Shader đo mức độ nhìn nghiêng của lá (tích vô hướng giữa pháp tuyến mặt lá và hướng nhìn). Khi gần như nhìn từ cạnh, nó đẩy đỉnh trái và phải ra xa nhau **trong view space**. Trên màn hình, lá luôn giữ được bề rộng từ mọi góc nhìn, làm cánh đồng trông dày hơn nhiều.

## 6. Tô màu (`shaders/grass.frag`)

- **Texture:** hai ảnh lá cỏ (`grass1.png`, `grass2.png`, 32 × 128) được ghép thành một `DataArrayTexture` (`textures.ts`). Shader lấy mẫu với UV = (`xSide`, `heightPercent`) và chọn lớp theo loại cỏ.
- **Hình dạng từ alpha:** pixel có alpha nhỏ hơn 0,5 bị loại bỏ. Geometry chỉ là một dải thẳng; đường viền nhọn của lá đến từ texture.
- **Ánh sáng:**
  - đèn bán cầu: ấm từ trên, xanh đậm từ dưới, trộn theo thành phần y của pháp tuyến
  - một điểm sáng specular Phong yếu
- **AO giả:** màu tối dần về phía gốc (`heightPercent²` đổi sang khoảng 0,125 … 1), mô phỏng bóng râm sâu bên trong đám cỏ dày.
- **Gamma:** shader tự chuyển sang sRGB bằng `pow(colour, 1/2.2)`. Vì vậy texture được tải mà không chuyển đổi không gian màu.

## 7. Mặt đất và bầu trời

**Mặt đất.**

- Vertex shader dời từng đỉnh của mặt phẳng dày bằng cùng hàm `terrainHeight()` như gốc cỏ.
- Fragment shader vẽ lưới kiểu "prototype": mỗi ô 1 m có độ sáng ngẫu nhiên, vạch tối mỗi 1 m, vạch tối hơn mỗi 10 m, tất cả từ một texture lưới lấy mẫu ở hai tỉ lệ.

**Bầu trời.** Màu được tính theo **vị trí trên màn hình** (`gl_FragCoord / resolution`), không theo hướng nhìn. Đây là phông nền cách điệu, rẻ. Do đó bầu trời không đổi khi xoay camera, và uniform `resolution` phải được cập nhật mỗi khi đổi kích thước.

## 8. Cỏ tương tác: ngả ra khi có vật đi qua

Lá cỏ ngả ra xa khi nhân vật hoặc vật thể đi qua, rồi từ từ đứng dậy. Có ba phần làm việc này.

### Trample map (`trample-map.ts`, `shaders/trample.frag`)

Một texture half-float 256 × 256 trải lên vùng cỏ, mỗi texel khoảng 0,4 m. Mỗi texel lưu một vector 2D trong kênh đỏ và xanh lá:

- **hướng:** cỏ ở chỗ đó bị đẩy về phía nào (trên mặt phẳng đất)
- **độ dài:** bị đè mạnh cỡ nào, từ 0 (đứng thẳng) tới 1 (đè hết cỡ)

Mỗi frame, một pass toàn màn hình nhỏ cập nhật nó: đọc texture của frame trước và ghi ra texture mới (hai texture thay phiên nhau):

1. **Mờ dần:** vector cũ được nhân với `decay`. Cỏ bị đè từ từ đứng dậy.
2. **In dấu:** với mỗi vật đè, các texel trong bán kính của nó bị đẩy ra xa tâm vật. Mạnh nhất trong nửa bán kính, nhạt dần về 0 ở mép.

`decay = e^(−3·delta / recovery)`: sau `recovery` giây còn khoảng 5% độ đè. Nó chỉ phụ thuộc thời gian đã trôi qua, nên cỏ đứng dậy cùng tốc độ dù 30 hay 144 fps.

### Uốn lá (`shaders/grass.vert`)

Vertex shader đọc trample map một lần, tại gốc lá. Tức là một lần đọc texture mỗi đỉnh, dù có bao nhiêu vật thể. Từ vector đó nó lấy:

- **độ đè** = độ dài vector
- **hướng** = vector đã chuẩn hoá

Sau đó nó thêm một phép xoay trước phép xoay của gió: quanh trục nằm ngang vuông góc với hướng đẩy, một góc `độ đè × trampleBend × heightPercent`. Giống gió, gốc đứng yên còn ngọn ngả nhiều nhất, nên lá cong xuống chứ không đổ thẳng như que.

Cỏ đang bị đè cũng ít bị gió lay hơn (`windLean × (1 − độ đè)`). Nếu không thì cỏ nằm rạp vẫn phất phơ.

Một chi tiết: hàm `rotateAxis` dựng ma trận theo thứ tự chuyển vị, nên thực tế nó xoay theo góc **âm**. Trục đè được đảo dấu để bù lại; trong shader có chú thích ngay cạnh.

### Vật đè và nhân vật (`player.ts`, `player-input.ts`, `grass-scene.ts`)

Bất cứ thứ gì có `position` và `trampleRadius` (interface `Interactor`) đều đè được cỏ. Đăng ký bằng `world.addInteractor(obj)`. Tối đa 8 cùng lúc (`MAX_INTERACTORS`).

Vật đè của demo là `PlayerBall`, một quả bóng cam:

- đi bằng **W A S D** / phím mũi tên theo hướng nhìn của camera (`moveDirection`), Shift để chạy
- lăn không trượt
- nằm trên mặt đất nhờ `GrassScene.heightAt(x, z)`
- camera đi theo nó

Bật **"Tự đi vòng tròn"** trên bảng điều khiển thì quả bóng tự đi vòng tròn khi không bấm phím.

### Vì sao noise địa hình thay đổi

Để đặt quả bóng lên đồi, CPU phải tính ra đúng độ cao như GPU. Noise gốc dùng hash dựa trên `sin()`, cho kết quả khác nhau giữa GLSL (float32, `sin` tuỳ GPU) và JavaScript.

Hash điểm lưới trong `noise.glsl` giờ là `latticeGradient`, một hash số nguyên pcg3d. Phép nhân và XOR số nguyên cho kết quả giống hệt ở cả hai phía, nên `terrain.ts` tính lại địa hình lệch chưa tới một micromet. Vì vậy đồi (và kiểu gió, vốn dùng cùng noise) trông khác demo gốc. Ngẫu nhiên của từng lá vẫn dùng hash `sin` cũ, vì CPU không cần tới nó.

## Muốn thay đổi thì sửa ở đâu

| Muốn đổi…                                     | Sửa                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------ |
| Số lá, kích thước lá, địa hình, gió mặc định  | `params.ts` (`defaultGrassParams`)                                             |
| Slider trên bảng điều khiển và khoảng giá trị | `src/routes/games/infinite-grass/components/controls.ts`                       |
| Hình dạng đồi                                 | `shaders/terrain.glsl`: dùng chung cho mặt đất và cỏ nên luôn khớp nhau        |
| Hình dạng lá, độ cong, gió                    | `shaders/grass.vert`                                                           |
| Màu và ánh sáng của lá                        | `shaders/grass.frag`, `textures/grass*.png`                                    |
| Lối đi                                        | `textures/tileData.jpg` (trắng = lối đi)                                       |
| Thêm vật thể mới                              | Tạo class giống `Sky`/`Ground` nhận `SharedUniforms`; thêm nó vào `GrassScene` |
| Cỏ phản ứng thế nào khi bị đè                 | `trampleRadius` / `trampleBend` / `trampleRecovery` trong `params.ts`          |
| Hình dạng vết đè (độ nhạt dần, hướng đẩy)     | `shaders/trample.frag`                                                         |
| Cho vật thể khác đè cỏ                        | Cho nó `position` + `trampleRadius`, gọi `world.addInteractor(obj)`            |
| Tốc độ nhân vật, vị trí camera, tự đi         | Các hằng số đầu file `grass-view.svelte`                                       |

## Giới hạn

- **Chưa vô tận.** Cỏ là một vùng cố định quanh gốc toạ độ và mặt đất rộng 500 m. Muốn cánh đồng vô tận thật thì phải đặt lá cỏ theo lưới trong không gian thế giới quanh camera, để lá đứng yên khi camera di chuyển. Mặt đất cũng phải đi theo camera.
- **Mật độ cố định.** Nhiều lá hơn hoặc vùng nhỏ hơn thì cỏ dày hơn. Không có level of detail: lá ở xa tốn chi phí như lá ở gần.
- **Một nguồn sáng.** Hướng và màu ánh sáng là hằng số trong `grass.frag`.
- **Chỉ đè được trong vùng cỏ.** Trample map đặt tâm ở vùng cỏ, nên với cánh đồng vô tận nó cũng phải đi theo camera cùng với cỏ.
- **Bỏ qua độ cao của vật đè.** Chỉ in dấu theo x và z, nên vật bay phía trên cỏ vẫn làm cỏ rạp. Tối đa 8 vật đè cùng lúc.
