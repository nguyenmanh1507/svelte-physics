# Volume Rendering với Three.js + Svelte

Oct 6, 2026 · @Theo Hernandez

## Tổng quan

Bạn sẽ dựng một quả cầu khói/mây render theo thời gian thực bằng ray-marching, viết bằng GLSL trong `ShaderMaterial` của Three.js, điều khiển qua UI Svelte 5. Tutorial đi đúng thứ tự của bài Scratchapixel, mỗi bước thêm một khái niệm vật lý và một file shader mới, nên bạn luôn so được "trước" và "sau".

| Bước | Khái niệm trong bài viết | Thứ bạn thấy trên màn hình |
| --- | --- | --- |
| 1 | Tia camera, giao tia với hình cầu | Quả cầu tô theo quãng đường tia đi bên trong |
| 2 | Hấp thụ, Beer's law, trộn nền | Quả cầu mờ đục ở tâm, trong ở rìa |
| 3 | In-scattering, Riemann sum, ray-marching | Quả cầu có mặt sáng và mặt tối theo hướng đèn |
| 4 | Hệ số tán xạ, phase function | Viền sáng khi nhìn ngược đèn |
| 5 | Mật độ không đồng đều | Đám mây có hình khối từ noise |
| 6 | (Svelte) | Slider đổi tham số, đổi bước ngay lập tức |

&#91;image: Kết quả của bước 1 đến bước 5, chụp từ dự án mẫu\]

Ảnh trên chụp từ chính code trong tutorial này, chạy với tham số mặc định của từng bước.

Bước 3 trả lời phần "teaser" cuối bài viết. Bước 4 giải hai câu hỏi tác giả để ngỏ: bao nhiêu ánh sáng tán xạ về phía mắt, và ánh sáng đó bị hấp thụ thế nào trên đường ra.

**Kiến thức cần có:** JavaScript/TypeScript, Three.js cơ bản (scene, camera, mesh), đọc được GLSL ở mức `vec3`, `uniform`, `for`. Không cần biết tích phân.

**Các lựa chọn kỹ thuật**

- **Three.js thuần + `ShaderMaterial`**, không dùng Threlte. Bạn nhìn thấy toàn bộ luồng dữ liệu từ Svelte tới uniform.
- **GLSL (WebGL2)**, chưa dùng TSL/WebGPU. Code shader gần như trùng với pseudo-code C++ của bài viết.
- **Mọi tính toán nằm trong fragment shader.** Mỗi pixel là một tia camera, giống hàm `traceScene` của bài viết.
- **Màu nền truyền vào shader qua uniform** và trộn ngay trong shader, đúng như công thức của bài. Phần mở rộng cuối tutorial chỉ cách trộn với một scene thật.

## Thiết lập dự án

Dự án là một app Vite + Svelte 5 + TypeScript với một component canvas và một thư mục shader. Code dưới đây đã được build và chạy thử với `three` 0.186, `svelte` 5.57, `vite` 8.

```bash
npm create vite@latest volume-tutorial -- --template svelte-ts
cd volume-tutorial
npm install
npm install three
npm install -D @types/three
```

Xoá `src/lib/Counter.svelte` và `src/assets`, rồi tạo cấu trúc sau:

```text
src/
  App.svelte
  app.css
  main.ts
  lib/volume/
    VolumeCanvas.svelte     // renderer, camera, material
    params.ts               // kiểu và giá trị mặc định của tham số
    shaders/
      volume.vert           // vertex shader dùng chung
      common.glsl           // uniforms, giao tia-cầu, main()
      step1.frag ... step5.frag   // mỗi bước một hàm shade()
```

### Ý tưởng kiến trúc

Ta vẽ một cái hộp bao quanh quả cầu, và fragment shader của hộp làm toàn bộ việc render volume. Hộp chỉ là "màn chiếu": nó đảm bảo GPU chạy shader cho đúng những pixel có thể nhìn thấy quả cầu. Với mỗi pixel, shader dựng một tia từ camera, giống vòng lặp `for each pixel → computeRay → traceScene` trong bài viết.

Để mỗi bước chỉ khác nhau đúng phần vật lý, `common.glsl` giữ phần cố định và gọi hàm `shade(ro, rd)`. Mỗi file `stepN.frag` chỉ định nghĩa hàm đó. Fragment shader hoàn chỉnh là chuỗi `common + stepN`.

### `src/app.css`

```css
html,
body {
  margin: 0;
  height: 100%;
  overflow: hidden;
}
```

### `shaders/volume.vert`

```glsl
// Vertex shader: chỉ làm một việc là báo cho fragment shader biết
// điểm đang tô nằm ở đâu trong không gian world.
varying vec3 vWorldPos;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
```

### `shaders/common.glsl`

```glsl
// Phần dùng chung cho mọi bước: uniforms, giao tia-cầu, và main().
// Mỗi file stepN.frag chỉ cần định nghĩa hàm shade().

uniform vec3 uBackground;    // màu nền (bức tường xanh trong bài viết)
uniform vec3 uScatterColor;  // màu "phản xạ" của volume (bước 2, 3)
uniform vec3 uLightDir;      // hướng TỚI nguồn sáng, đã chuẩn hoá
uniform vec3 uLightColor;    // màu x cường độ của đèn
uniform float uSigmaA;       // hệ số hấp thụ
uniform float uSigmaS;       // hệ số tán xạ
uniform float uG;            // độ bất đối xứng của phase function (-1..1)
uniform float uNoiseScale;   // tần số noise (bước 5)
uniform float uTime;
uniform int uSteps;          // số bước march dọc tia camera
uniform int uLightSteps;     // số bước march về phía đèn (bước 5)

varying vec3 vWorldPos;

const float PI = 3.14159265359;
const vec3 SPHERE_CENTER = vec3(0.0);
const float SPHERE_RADIUS = 1.0;

// Giao tia với hình cầu. Trả về false nếu trượt.
// t0, t1 là khoảng cách dọc tia tới điểm vào và điểm ra.
bool intersectSphere(vec3 ro, vec3 rd, out float t0, out float t1) {
  vec3 oc = ro - SPHERE_CENTER;
  float b = dot(oc, rd);
  float c = dot(oc, oc) - SPHERE_RADIUS * SPHERE_RADIUS;
  float h = b * b - c;
  if (h < 0.0) return false;
  h = sqrt(h);
  t0 = -b - h;
  t1 = -b + h;
  if (t1 < 0.0) return false; // cả quả cầu nằm sau lưng camera
  t0 = max(t0, 0.0);          // camera nằm trong quả cầu
  return true;
}

// Mỗi bước tự định nghĩa hàm này.
vec3 shade(vec3 ro, vec3 rd);

void main() {
  vec3 ro = cameraPosition;                        // gốc tia = vị trí camera
  vec3 rd = normalize(vWorldPos - cameraPosition); // hướng tia qua pixel này
  gl_FragColor = vec4(shade(ro, rd), 1.0);
  #include <colorspace_fragment>
}
```

Ba điều đáng chú ý:

- `cameraPosition`, `modelMatrix`, `viewMatrix`, `projectionMatrix` do `ShaderMaterial` tự khai báo và tự cập nhật. Bạn không cần truyền.
- `#include <colorspace_fragment>` đổi màu từ linear sang sRGB, để màu nền trong shader trùng khớp với `scene.background`.
- Ta khai báo sẵn mọi uniform cho cả 5 bước. Uniform chưa dùng không gây lỗi.

### Năm file `stepN.frag` tạm thời

Tạo `step1.frag` tới `step5.frag`, mỗi file tạm chứa đúng nội dung này. Component sẽ import cả năm ngay từ đầu, và bạn thay nội dung từng file khi tới bước tương ứng.

```glsl
vec3 shade(vec3 ro, vec3 rd) {
  return uBackground;
}
```

### `params.ts`

```ts
export interface VolumeParams {
  sigmaA: number;
  sigmaS: number;
  g: number;
  lightIntensity: number;
  lightAzimuth: number;   // độ, quay quanh trục Y
  lightElevation: number; // độ, so với mặt phẳng ngang
  steps: number;
  lightSteps: number;
  noiseScale: number;
}

export const defaultParams: VolumeParams = {
  sigmaA: 0.5,
  sigmaS: 2.0,
  g: 0.0,
  lightIntensity: 12,
  lightAzimuth: 60,
  lightElevation: 35,
  steps: 48,
  lightSteps: 8,
  noiseScale: 2.5,
};
```

### `VolumeCanvas.svelte`

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
  import type { VolumeParams } from './params';

  import vertexShader from './shaders/volume.vert?raw';
  import common from './shaders/common.glsl?raw';
  import step1 from './shaders/step1.frag?raw';
  import step2 from './shaders/step2.frag?raw';
  import step3 from './shaders/step3.frag?raw';
  import step4 from './shaders/step4.frag?raw';
  import step5 from './shaders/step5.frag?raw';

  const steps = [step1, step2, step3, step4, step5];

  let { step, params }: { step: number; params: VolumeParams } = $props();

  let canvas: HTMLCanvasElement;

  const background = new THREE.Color().setRGB(0.572, 0.772, 0.921);

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: common + steps[0],
    side: THREE.BackSide, // vẫn vẽ được khi camera chui vào trong hộp
    uniforms: {
      uBackground: { value: background },
      uScatterColor: { value: new THREE.Color().setRGB(0.8, 0.1, 0.5) },
      uLightDir: { value: new THREE.Vector3(0, 1, 0) },
      uLightColor: { value: new THREE.Color(1, 1, 1) },
      uSigmaA: { value: 0 },
      uSigmaS: { value: 0 },
      uG: { value: 0 },
      uNoiseScale: { value: 1 },
      uTime: { value: 0 },
      uSteps: { value: 1 },
      uLightSteps: { value: 1 },
    },
  });

  // Đổi bước -> đổi fragment shader và biên dịch lại.
  $effect(() => {
    material.fragmentShader = common + steps[step - 1];
    material.needsUpdate = true;
  });

  // Đổi slider -> ghi vào uniform. Không cần biên dịch lại.
  $effect(() => {
    const u = material.uniforms;
    u.uSigmaA.value = params.sigmaA;
    u.uSigmaS.value = params.sigmaS;
    u.uG.value = params.g;
    u.uNoiseScale.value = params.noiseScale;
    u.uSteps.value = params.steps;
    u.uLightSteps.value = params.lightSteps;
    u.uLightColor.value.setScalar(params.lightIntensity);

    const az = THREE.MathUtils.degToRad(params.lightAzimuth);
    const el = THREE.MathUtils.degToRad(params.lightElevation);
    u.uLightDir.value.set(
      Math.cos(el) * Math.sin(az),
      Math.sin(el),
      Math.cos(el) * Math.cos(az),
    );
  });

  onMount(() => {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    scene.background = background;

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 4);

    // Hộp bao quanh quả cầu bán kính 1. Hộp chỉ là "màn chiếu" cho shader.
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.2), material);
    scene.add(box);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = canvas.parentElement!;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas.parentElement!);
    resize();

    const timer = new THREE.Timer();
    renderer.setAnimationLoop(() => {
      timer.update();
      material.uniforms.uTime.value = timer.getElapsed();
      controls.update();
      renderer.render(scene, camera);
    });

    return () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      controls.dispose();
      box.geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  });
</script>

<div class="wrap">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .wrap {
    position: absolute;
    inset: 0;
  }
  canvas {
    display: block;
  }
</style>
```

Điểm nối Svelte với Three.js nằm ở hai `$effect`. Effect đọc `params.sigmaA`, `params.g`... nên Svelte tự chạy lại nó khi bất kỳ giá trị nào đổi. Material được tạo ở top-level của script vì nó không cần DOM; renderer cần `<canvas>` nên nằm trong `onMount`.

### `App.svelte` tạm thời

Bảng điều khiển sẽ đến ở bước 6. Trước đó, đổi số `step` bằng tay khi sang bước mới.

```svelte
<script lang="ts">
  import VolumeCanvas from './lib/volume/VolumeCanvas.svelte';
  import { defaultParams } from './lib/volume/params';
</script>

<VolumeCanvas step={1} params={defaultParams} />
```

Chạy `npm run dev`. Bạn thấy một màn hình xanh nhạt trống trơn: cái hộp đang được vẽ, nhưng `shade()` trả về đúng màu nền nên nó vô hình.

## Bước 1: Tia camera và giao tia với hình cầu

Mục tiêu của bước này là biết mỗi tia camera đi bao xa bên trong quả cầu, vì mọi công thức sau đều cần con số đó. Trong bài viết, đây là đoạn `sphere->intersect(ray_origin, ray_direction, t0, t1)`.

Một điểm trên tia có dạng `ro + rd * t`. Hàm `intersectSphere` trong `common.glsl` giải phương trình bậc hai để tìm hai giá trị `t`: `t0` là nơi tia đi vào, `t1` là nơi tia đi ra. Quãng đường trong volume là `t1 - t0`.

### `shaders/step1.frag`

```glsl
// BƯỚC 1: tia camera có đi qua quả cầu không, và đi bao xa bên trong?
vec3 shade(vec3 ro, vec3 rd) {
  float t0, t1;
  if (!intersectSphere(ro, rd, t0, t1)) return uBackground;

  float dist = t1 - t0;                        // quãng đường trong volume
  return vec3(dist / (2.0 * SPHERE_RADIUS));   // 0 = rìa, 1 = xuyên tâm
}
```

**Bạn sẽ thấy:** một đĩa tròn trắng ở tâm, tối dần về rìa. Đây không phải ánh sáng, mà là bản đồ "độ dày" của volume theo từng pixel. Kéo chuột để xoay: hình không đổi, vì quả cầu đối xứng.

**Thử nghiệm**

- Cuộn chuột để đưa camera vào trong quả cầu. Hình vẫn đúng nhờ `t0 = max(t0, 0.0)` và `side: BackSide`. Thử đổi thành `FrontSide` để thấy nó biến mất khi camera chui vào hộp.
- Trả về `rd * 0.5 + 0.5` thay cho màu xám. Đây là cách kiểm tra hướng tia có đúng không.

Vẽ một đại lượng trung gian ra màn hình như thế này là cách gỡ lỗi chính của shader. Bạn sẽ dùng lại nó nhiều lần.

## Bước 2: Beer's law và hấp thụ

Có quãng đường rồi, một dòng `exp` là đủ để biết bao nhiêu ánh sáng nền lọt qua volume. Đây là định luật Beer-Lambert:

```latex
T = e^{-\sigma_a \cdot d}
```

`T` là internal transmittance (0 đến 1), `σa` là hệ số hấp thụ, `d` là quãng đường. Phần `T` của màu nền đi xuyên qua; phần `1 - T` còn lại được thay bằng màu của volume. Đó chính là alpha blending với opacity bằng `1 - T`.

### `shaders/step2.frag`

```glsl
// BƯỚC 2: Beer's law. Volume hấp thụ ánh sáng nền và có màu riêng.
vec3 shade(vec3 ro, vec3 rd) {
  float t0, t1;
  if (!intersectSphere(ro, rd, t0, t1)) return uBackground;

  float dist = t1 - t0;
  float T = exp(-dist * uSigmaA);              // internal transmittance

  // T phần nền lọt qua, (1 - T) phần còn lại là màu của volume.
  return T * uBackground + (1.0 - T) * uScatterColor;
}
```

Đổi `step={2}` trong `App.svelte`.

**Bạn sẽ thấy:** quả cầu hồng, đục ở tâm và trong dần về rìa, giống loạt ảnh trong bài viết. Rìa mềm vì ở đó tia chỉ đi một đoạn rất ngắn trong volume.

**Thử nghiệm** (sửa tạm `sigmaA` trong `params.ts`)

| `sigmaA` | Mean free path `1/σa` | Kết quả |
| --- | --- | --- |
| 0 | vô hạn | Quả cầu biến mất, `T = 1` ở mọi nơi |
| 0.5 | 2 (bằng đường kính) | Mờ, còn nhìn xuyên được |
| 5 | 0.2 | Gần như một đĩa đặc, chỉ mềm ở sát mép |

So `1/σa` với kích thước vật thể là cách nhanh nhất để đoán volume sẽ đục hay trong. Quả cầu có đường kính 2 đơn vị: mean free path lớn hơn 2 thì trong, nhỏ hơn nhiều thì đục.

**Giới hạn của bước này:** xoay camera, quả cầu trông y hệt từ mọi phía. Màu hồng là một hằng số ta tự đặt, chưa có đèn nào chiếu vào.

## Bước 3: Ray-marching và in-scattering

Bước này thay màu hồng hằng số bằng ánh sáng thật từ một ngọn đèn, tính bằng vòng lặp đi dọc tia camera. Đây là thuật toán được mô tả ở cuối bài viết.

Ánh sáng đèn tán xạ về phía mắt ở mọi điểm trên đoạn từ `t0` đến `t1`, nên tổng lượng sáng là một tích phân. Ta xấp xỉ nó bằng tổng Riemann:

```latex
\int_{t_0}^{t_1} L_i(x, \omega)\,dx \;\approx\; \sum_{i=0}^{N-1} L_i(x_i, \omega)\,\Delta x
```

Chạy trong shader, mỗi số hạng của tổng là một vòng `for`:

1. Chia đoạn `[t0, t1]` thành `N` đoạn con dài `dx`.
2. Lấy điểm `x` ở giữa đoạn con thứ `i`.
3. Từ `x`, bắn một tia về phía đèn và đo quãng đường tới chỗ nó ra khỏi quả cầu.
4. Dùng Beer's law trên quãng đường đó để biết ánh sáng đèn còn lại bao nhiêu khi tới `x`.
5. Nhân với `dx` và cộng dồn.

Đèn ở đây là đèn định hướng (như mặt trời): mọi điểm nhìn về đèn theo cùng một hướng `uLightDir`.

### `shaders/step3.frag`

```glsl
// BƯỚC 3: ray-marching. Cộng dồn ánh sáng đèn tán xạ về phía mắt
// bằng tổng Riemann dọc đoạn [t0, t1].
vec3 shade(vec3 ro, vec3 rd) {
  float t0, t1;
  if (!intersectSphere(ro, rd, t0, t1)) return uBackground;

  float dx = (t1 - t0) / float(uSteps);        // bề rộng mỗi hình chữ nhật
  vec3 L = vec3(0.0);                          // ánh sáng in-scattering tích luỹ

  for (int i = 0; i < uSteps; i++) {
    // x nằm ở GIỮA đoạn con thứ i
    vec3 x = ro + rd * (t0 + (float(i) + 0.5) * dx);

    // Bắn tia từ x về phía đèn: ánh sáng đã đi bao xa trong volume?
    float l0, l1;
    intersectSphere(x, uLightDir, l0, l1);     // x ở trong cầu nên luôn trúng
    float lightAtten = exp(-l1 * uSigmaA);     // Beer's law trên tia sáng

    // Li(x) * dx
    L += uLightColor * lightAtten * dx;
  }

  float T = exp(-(t1 - t0) * uSigmaA);         // nền vẫn bị hấp thụ như bước 2
  return T * uBackground + L * uScatterColor;
}
```

Vì `x` nằm trong quả cầu, `intersectSphere` trả về `l0 = 0` và `l1` là khoảng cách từ `x` tới mặt cầu theo hướng đèn. Đó chính là quãng đường ánh sáng đã đi trong volume.

Mô hình ở bước này chưa có `σs` và phase function nên cần đèn yếu hơn. Sửa `App.svelte`:

```svelte
<VolumeCanvas step={3} params={{ ...defaultParams, sigmaA: 1.5, lightIntensity: 0.8 }} />
```

**Bạn sẽ thấy:** quả cầu có mặt sáng ở phía trên bên phải và mặt tối ở phía đối diện. Xoay camera: vùng sáng đứng yên theo đèn, không đi theo camera. Lần đầu tiên volume có hình khối.

**Thử nghiệm**

- Đặt `steps: 1`, rồi 2, 8, 48. Hình vẫn mượt ở mọi giá trị, chỉ có độ sáng và vị trí vùng chuyển sáng tối lệch đi một chút khi số bước thấp. Volume đồng nhất rất "dễ" tích phân; số bước chỉ thật sự quan trọng từ bước 5.
- Đặt `sigmaA: 0`. Không còn hạt nào trong volume, nhưng quả cầu vẫn sáng rực. Đây là lỗi của mô hình, không phải lỗi code.

Thí nghiệm thứ hai cho thấy đúng hai lỗ hổng mà bài viết nêu ở đoạn kết:

1. Ta đã biết bao nhiêu ánh sáng **tới** `x`, nhưng chưa tính bao nhiêu phần trong đó **tán xạ về phía mắt**. Hiện tại code coi như 100%, dù không có hạt nào để tán xạ.
2. Ánh sáng tán xạ tại `x` còn phải đi từ `x` ra tới `t0` để về mắt, và bị hấp thụ trên đoạn đó. Code chưa tính.

## Bước 4: Hệ số tán xạ và phase function

Bước này vá hai lỗ hổng của bước 3 bằng ba thay đổi nhỏ trong vòng lặp, và cho ra mô hình single scattering đầy đủ cho volume đồng nhất. Phần này đi xa hơn chương mở đầu của bài viết.

### Ba khái niệm mới

**Hệ số tán xạ `σs`.** Khi photon gặp hạt, nó bị hấp thụ (xác suất theo `σa`) hoặc bị hất sang hướng khác (xác suất theo `σs`). Chỉ phần `σs` mới có cơ hội tới mắt, nên lượng in-scattering phải nhân với `σs`. Không có hạt thì `σs = 0` và quả cầu tự biến mất.

**Hệ số suy giảm `σt = σa + σs`.** Với một chùm sáng đang đi thẳng, photon bị hấp thụ hay bị hất đi chỗ khác đều là mất. Vì vậy mọi chỗ dùng Beer's law giờ dùng `σt` thay cho `σa`. Hiện tượng mất sáng do tán xạ gọi là out-scattering.

**Phase function `p(θ)`.** Trong số ánh sáng bị tán xạ, bao nhiêu phần đi đúng về hướng mắt? Phase function trả lời theo góc `θ` giữa hướng ánh sáng đang đi và hướng về mắt. Đây là vai trò của biến `ω` mà bài viết nói là "chưa dùng tới". Ta dùng hàm Henyey-Greenstein, có một tham số `g`:

```latex
p(\theta) = \frac{1}{4\pi}\cdot\frac{1-g^2}{\left(1+g^2-2g\cos\theta\right)^{3/2}}
```

| `g` | Hành vi | Ví dụ |
| --- | --- | --- |
| 0 | Tán xạ đều mọi hướng, `p = 1/4π` | Khói mịn, sương mỏng |
| > 0 | Ưu tiên đi tiếp về phía trước | Mây, sương mù (viền sáng khi ngược nắng) |
| < 0 | Ưu tiên dội ngược lại | Ít gặp trong tự nhiên |

### Công thức cho một mẫu

Đóng góp của điểm `x` vào pixel là tích của năm thứ, đọc từ đèn tới mắt:

```latex
\underbrace{L_{\text{đèn}}\, e^{-\sigma_t\, l}}_{\text{tới } x}
\cdot \underbrace{\sigma_s\, p(\theta)}_{\text{tán xạ về mắt}}
\cdot \underbrace{T(x)}_{\text{từ } x \text{ về mắt}}
\cdot \Delta x
```

`T(x)` là transmittance từ mắt tới `x`. Vì ta march từ gần ra xa, chỉ cần giữ một biến `T` và nhân nó với `exp(-σt * dx)` sau mỗi bước. Khi vòng lặp kết thúc, `T` cũng chính là transmittance của cả đoạn, dùng luôn cho màu nền.

### `shaders/step4.frag`

```glsl
// BƯỚC 4: mô hình đầy đủ cho volume đồng nhất.
// Thêm hệ số tán xạ, phase function, và hấp thụ trên đường về mắt.

// Henyey-Greenstein: xác suất ánh sáng lệch một góc theta khi tán xạ.
// g = 0: đều mọi hướng. g > 0: ưu tiên đi thẳng. g < 0: ưu tiên dội ngược.
float phaseHG(float cosTheta, float g) {
  float g2 = g * g;
  float denom = 1.0 + g2 - 2.0 * g * cosTheta;
  return (1.0 - g2) / (4.0 * PI * pow(denom, 1.5));
}

vec3 shade(vec3 ro, vec3 rd) {
  float t0, t1;
  if (!intersectSphere(ro, rd, t0, t1)) return uBackground;

  float sigmaT = uSigmaA + uSigmaS;            // hệ số suy giảm (extinction)
  float dx = (t1 - t0) / float(uSteps);
  float phase = phaseHG(dot(rd, uLightDir), uG);

  float T = 1.0;                               // transmittance từ mắt tới x
  vec3 L = vec3(0.0);

  for (int i = 0; i < uSteps; i++) {
    vec3 x = ro + rd * (t0 + (float(i) + 0.5) * dx);

    T *= exp(-sigmaT * dx);                    // câu hỏi 2: hấp thụ trên đường về mắt

    float l0, l1;
    intersectSphere(x, uLightDir, l0, l1);
    float lightAtten = exp(-l1 * sigmaT);

    // câu hỏi 1: chỉ phần sigmaS * phase được tán xạ về phía mắt
    L += T * uLightColor * lightAtten * uSigmaS * phase * dx;
  }

  return T * uBackground + L;
}
```

`cosTheta` là `dot(rd, uLightDir)`: ánh sáng đi theo hướng `-uLightDir`, hướng về mắt là `-rd`, và tích vô hướng của hai vector đó bằng `dot(rd, uLightDir)`. Với đèn định hướng, góc này như nhau ở mọi `x` trên tia nên tính một lần ngoài vòng lặp.

Màu `uScatterColor` không còn được dùng: màu của volume giờ sinh ra từ màu đèn và các hệ số. Trả `App.svelte` về `step={4} params={defaultParams}`.

**Bạn sẽ thấy:** một quả cầu khói xám, sáng ở phía đèn và tối ở phía khuất. Đèn mặc định mạnh gấp 15 lần bước 3 vì phase function đẳng hướng chỉ gửi `1/4π ≈ 0.08` lượng sáng về mỗi hướng.

**Thử nghiệm**

- `sigmaS: 0`: không còn in-scattering, còn lại một quả cầu chỉ làm tối nền. Đây là bước 2 với màu volume đen, cũng là trường hợp "bia và đá quý" trong bài viết.
- `sigmaA: 0, sigmaS: 2`: khói trắng hơn. Tỷ lệ `σs / σt` gọi là albedo: gần 1 là mây trắng, gần 0 là khói đen.
- `g: 0.6, lightAzimuth: 160, lightElevation: 15`: đèn nằm sau quả cầu. Một viền trăng lưỡi liềm sáng rực xuất hiện ở mép gần đèn, giống viền bạc của mây ngược nắng. Đổi `g` về 0 thì viền này tối đi rõ rệt.

Vùng viền đó cháy trắng vì giá trị màu vượt quá 1. Điều này đúng về vật lý; xử lý nó bằng tone mapping là một bài tập ở cuối.

## Bước 5: Mật độ không đồng đều

Để có mây thay vì một quả cầu khói đều, ta cho mật độ thay đổi theo vị trí bằng một hàm `density(p)` trả về giá trị 0 đến 1. Thuật toán giữ nguyên; đây là lý do bài viết chọn ray-marching thay vì tìm nghiệm giải tích.

### Điều gì thay đổi so với bước 4

| Chỗ | Bước 4 (đồng nhất) | Bước 5 (không đồng nhất) |
| --- | --- | --- |
| Hệ số tại `x` | `σt`, `σs` cố định | `σt * density(x)`, `σs * density(x)` |
| Suy giảm về mắt | `T *= exp(-σt * dx)` | `T *= exp(-σt * density(x) * dx)` |
| Suy giảm từ đèn | Một lần `exp(-σt * l)` | Phải march một vòng lặp thứ hai về phía đèn |

Dòng cuối là thay đổi lớn nhất. Mật độ trên đường tới đèn không còn đều, nên ta phải cộng dồn `σt * density * dl` qua từng đoạn nhỏ. Tổng đó gọi là optical depth `τ`, và transmittance là `exp(-τ)`.

Chi phí mỗi pixel tăng từ `N` lên `N × M` lần lấy mẫu mật độ (`N` bước camera, `M` bước về đèn). Với mặc định 48 × 8 là 384 lần gọi `density`, mỗi lần 4 lớp noise. Vì vậy bước này có thêm ba tối ưu nhỏ.

### `shaders/step5.frag`

```glsl
// BƯỚC 5: mật độ thay đổi theo vị trí. Cùng thuật toán bước 4,
// nhưng sigma tại mỗi điểm được nhân với density(x).

float phaseHG(float cosTheta, float g) {
  float g2 = g * g;
  float denom = 1.0 + g2 - 2.0 * g * cosTheta;
  return (1.0 - g2) / (4.0 * PI * pow(denom, 1.5));
}

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

// Value noise 3D: nội suy 8 giá trị ngẫu nhiên ở 8 đỉnh ô lưới.
float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i + vec3(0, 0, 0)), hash(i + vec3(1, 0, 0)), f.x),
        mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
        mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}

// fBm: cộng nhiều lớp noise, mỗi lớp tần số gấp đôi và biên độ giảm nửa.
float fbm(vec3 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    sum += amp * noise(p);
    p *= 2.0;
    amp *= 0.5;
  }
  return sum; // khoảng 0..0.94
}

// Mật độ tại điểm p, trong khoảng 0..1.
float density(vec3 p) {
  float r = length(p - SPHERE_CENTER) / SPHERE_RADIUS;
  float falloff = 1.0 - smoothstep(0.5, 1.0, r);      // mờ dần về rìa cầu
  float n = fbm(p * uNoiseScale + vec3(0.0, 0.0, uTime * 0.15));
  return falloff * smoothstep(0.3, 0.7, n);           // khoét lỗ để tạo cụm
}

// Optical depth từ x tới chỗ tia sáng ra khỏi volume.
float lightOpticalDepth(vec3 x, float sigmaT) {
  float l0, l1;
  intersectSphere(x, uLightDir, l0, l1);
  float dl = l1 / float(uLightSteps);
  float tau = 0.0;
  for (int j = 0; j < uLightSteps; j++) {
    vec3 p = x + uLightDir * ((float(j) + 0.5) * dl);
    tau += sigmaT * density(p) * dl;
  }
  return tau;
}

vec3 shade(vec3 ro, vec3 rd) {
  float t0, t1;
  if (!intersectSphere(ro, rd, t0, t1)) return uBackground;

  float sigmaT = uSigmaA + uSigmaS;
  float dx = (t1 - t0) / float(uSteps);
  float phase = phaseHG(dot(rd, uLightDir), uG);

  // Lệch điểm bắt đầu một lượng ngẫu nhiên theo pixel để giấu vân sọc.
  float jitter = hash(vec3(gl_FragCoord.xy, 1.0));

  float T = 1.0;
  vec3 L = vec3(0.0);

  for (int i = 0; i < uSteps; i++) {
    vec3 x = ro + rd * (t0 + (float(i) + jitter) * dx);
    float rho = density(x);
    if (rho <= 0.001) continue;                // chỗ trống: bỏ qua, khỏi march về đèn

    T *= exp(-sigmaT * rho * dx);

    // Đèn chính: bị che bởi phần mây nằm giữa x và đèn.
    vec3 Li = uLightColor * exp(-lightOpticalDepth(x, sigmaT)) * phase;
    // Ánh sáng trời: coi như đều mọi hướng và không bị che. Đây là xấp xỉ
    // rẻ tiền, hệ số 0.4 là con số chỉnh bằng mắt chứ không phải vật lý.
    Li += 0.4 * uBackground;

    L += T * Li * uSigmaS * rho * dx;

    if (T < 0.01) break;                       // đã đục hẳn: phần phía sau không còn đóng góp
  }

  return T * uBackground + L;
}
```

Sửa `App.svelte` để dùng bộ số của mây (albedo gần 1, tán xạ thiên về phía trước):

```svelte
<VolumeCanvas step={5} params={{ ...defaultParams, sigmaA: 0.02, sigmaS: 6, g: 0.3 }} />
```

**Bạn sẽ thấy:** một đám mây nhỏ có cụm và hốc, sáng ở phía đèn, xám xanh ở phía khuất, và biến hình chậm theo thời gian.

### Giải thích các phần mới

- **`density()`** là tích của hai thứ: `falloff` đưa mật độ về 0 ở mặt cầu để không lộ đường biên tròn, và fBm tạo chi tiết. `smoothstep(0.3, 0.7, n)` biến noise mềm thành các cụm có khoảng trống ở giữa.
- **Jitter.** Nếu mọi pixel lấy mẫu ở cùng các độ sâu, sai số Riemann hiện thành các vân đồng tâm. Lệch ngẫu nhiên theo pixel đổi vân sọc thành nhiễu hạt, thứ mắt dễ chấp nhận hơn.
- **Bỏ qua chỗ trống và thoát sớm.** Hai dòng `continue` và `break` tránh vòng lặp về đèn ở những mẫu không đóng góp gì.
- **Ánh sáng trời.** Chỉ với một đèn và single scattering, mặt khuất của mây đen kịt, vì ngoài đời thật nó được chiếu bởi ánh sáng nảy nhiều lần trong mây (multiple scattering) và bởi bầu trời. Dòng `Li += 0.4 * uBackground` là một xấp xỉ thô cho phần đó. Xoá nó đi để thấy single scattering "thuần" trông ra sao.

**Thử nghiệm**

- Bỏ `jitter` (thay bằng `0.5`) và đặt `steps: 12`: các vân sọc hiện ra.
- `lightSteps: 1` rồi 8: bóng đổ trong mây từ thô sang mịn. Số bước về đèn thường để thấp hơn nhiều so với số bước camera.
- `noiseScale: 1` rồi 6: từ một khối lớn sang nhiều cụm nhỏ.

## Bước 6: Bảng điều khiển Svelte

Bước cuối thay việc sửa số bằng tay bằng nút chọn bước và slider, để bạn kéo tham số và thấy kết quả ngay. `VolumeCanvas.svelte` không cần sửa gì: nó đã nhận `step` và `params` qua props từ đầu.

### `App.svelte` hoàn chỉnh

```svelte
<script lang="ts">
  import VolumeCanvas from './lib/volume/VolumeCanvas.svelte';
  import { defaultParams, type VolumeParams } from './lib/volume/params';

  const stepNames = [
    '1. Giao tia - cầu',
    "2. Beer's law",
    '3. Ray-marching',
    '4. Phase function',
    '5. Mây (noise)',
  ];

  // Mỗi bước dùng một mô hình ánh sáng khác nhau nên cần bộ số khởi đầu riêng.
  const presets: Record<number, Partial<VolumeParams>> = {
    3: { sigmaA: 1.5, lightIntensity: 0.8 },
    4: { sigmaA: 0.5, sigmaS: 2, lightIntensity: 12 },
    5: { sigmaA: 0.02, sigmaS: 6, g: 0.3, lightIntensity: 12 },
  };

  let step = $state(1);
  let params: VolumeParams = $state({ ...defaultParams });

  function selectStep(n: number) {
    step = n;
    params = { ...defaultParams, ...presets[n] };
  }

  type Slider = {
    key: keyof VolumeParams;
    label: string;
    min: number;
    max: number;
    step: number;
    from: number; // slider xuất hiện từ bước nào
  };

  const sliders: Slider[] = [
    { key: 'sigmaA', label: 'σa hấp thụ', min: 0, max: 5, step: 0.01, from: 2 },
    { key: 'sigmaS', label: 'σs tán xạ', min: 0, max: 10, step: 0.01, from: 4 },
    { key: 'g', label: 'g (phase)', min: -0.9, max: 0.9, step: 0.01, from: 4 },
    { key: 'lightIntensity', label: 'Cường độ đèn', min: 0, max: 40, step: 0.1, from: 3 },
    { key: 'lightAzimuth', label: 'Đèn: góc quay', min: -180, max: 180, step: 1, from: 3 },
    { key: 'lightElevation', label: 'Đèn: góc cao', min: -89, max: 89, step: 1, from: 3 },
    { key: 'steps', label: 'Số bước', min: 1, max: 128, step: 1, from: 3 },
    { key: 'lightSteps', label: 'Số bước về đèn', min: 1, max: 32, step: 1, from: 5 },
    { key: 'noiseScale', label: 'Tần số noise', min: 0.5, max: 8, step: 0.1, from: 5 },
  ];
</script>

<main>
  <VolumeCanvas {step} {params} />

  <aside>
    <div class="steps">
      {#each stepNames as name, i}
        <button class:active={step === i + 1} onclick={() => selectStep(i + 1)}>{name}</button>
      {/each}
    </div>

    {#each sliders.filter((s) => step >= s.from) as s (s.key)}
      <label>
        <span>{s.label}</span>
        <input type="range" min={s.min} max={s.max} step={s.step} bind:value={params[s.key]} />
        <output>{params[s.key]}</output>
      </label>
    {/each}

    <button onclick={() => selectStep(step)}>Đặt lại</button>
  </aside>
</main>

<style>
  main {
    position: fixed;
    inset: 0;
  }
  aside {
    position: absolute;
    top: 12px;
    left: 12px;
    width: 280px;
    padding: 12px;
    display: grid;
    gap: 8px;
    background: rgb(20 24 32 / 0.82);
    color: #e8edf3;
    border-radius: 10px;
    font: 13px/1.4 system-ui, sans-serif;
  }
  .steps {
    display: grid;
    gap: 4px;
  }
  button {
    padding: 6px 8px;
    border: 1px solid #3a4352;
    border-radius: 6px;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  button.active {
    background: #e8edf3;
    color: #141820;
  }
  label {
    display: grid;
    grid-template-columns: 96px 1fr 40px;
    align-items: center;
    gap: 8px;
  }
  output {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
```

### Dữ liệu đi từ slider tới GPU như thế nào

1. `bind:value={params[s.key]}` ghi giá trị slider vào object `params`, là một `$state` proxy.
2. `params` đi xuống `VolumeCanvas` qua prop.
3. `$effect` trong `VolumeCanvas` đã đọc `params.sigmaA`, `params.g`... nên Svelte chạy lại nó và ghi giá trị mới vào `material.uniforms`.
4. Frame kế tiếp của `setAnimationLoop` gửi uniform lên GPU.

Đổi slider chỉ là ghi một con số, không biên dịch lại shader. Đổi bước thì khác: effect thứ nhất gán `fragmentShader` mới và đặt `needsUpdate = true`, buộc Three.js biên dịch lại chương trình. Vì thế đừng bao giờ đưa một tham số hay đổi vào chuỗi shader bằng `#define`; hãy dùng uniform.

## Gỡ lỗi, hiệu năng và bài tập

### Gỡ lỗi nhanh

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
| --- | --- | --- |
| Hộp đen hoặc không thấy gì | Shader không biên dịch được | Mở console: Three.js in lỗi GLSL kèm số dòng. Số dòng tính trên chuỗi `common + stepN` |
| Thấy rõ hình hộp vuông khác màu nền | Thiếu `#include <colorspace_fragment>`, hoặc nhánh trượt không trả về `uBackground` | Kiểm tra `main()` trong `common.glsl` |
| Volume biến mất khi zoom sát | Material đang dùng `FrontSide` | Đổi về `BackSide` |
| Quả cầu trắng xoá ở bước 3 | `lightIntensity` còn ở mức 12 của bước 4 | Hạ xuống khoảng 0.8 |
| Slider không có tác dụng | Tên uniform trong GLSL khác tên trong `uniforms` | So từng ký tự; Three.js bỏ qua uniform sai tên mà không báo lỗi |
| FPS thấp ở bước 5 | Quá nhiều mẫu mỗi pixel | Giảm `steps`, `lightSteps`, hoặc pixel ratio |

Khi nghi ngờ một đại lượng, hãy vẽ nó ra như ở bước 1: `return vec3(T);`, `return vec3(density(x));`, `return vec3(float(i) / float(uSteps));`.

### Hiệu năng

Chi phí của ray-marching bằng số pixel nhân số mẫu mỗi pixel, nên có ba hướng giảm:

- **Ít pixel hơn.** `setPixelRatio(1)` thay vì 2 giảm 4 lần số pixel trên màn hình retina. Game thường render volume ở nửa độ phân giải rồi phóng lên.
- **Ít mẫu hơn.** Giảm `steps` và dựa vào jitter để giấu sai số; giữ `lightSteps` ở mức 4 đến 8.
- **Mẫu rẻ hơn.** Thay fBm tính trực tiếp bằng một `Data3DTexture` chứa noise tính sẵn: mỗi lần gọi `density` còn một lần đọc texture.

### Bài tập

Các bài dưới đây chưa có lời giải trong dự án mẫu; gợi ý chỉ là hướng đi.

- [ ] **Màu cho khói.** Đổi `uSigmaA` thành `vec3` để mỗi kênh màu bị hấp thụ khác nhau. `T` cũng thành `vec3`. Đây là cách bia có màu vàng.
- [ ] **Đèn điểm.** Thay `uLightDir` bằng `uLightPos`. Hướng tới đèn và `cosTheta` giờ khác nhau ở mỗi `x`, và cường độ giảm theo bình phương khoảng cách.
- [ ] **Tone mapping.** Áp dụng `L = L / (1.0 + L)` (Reinhard) trước khi cộng với nền để viền sáng ở bước 4 không cháy trắng.
- [ ] **Phát sáng.** Thêm một số hạng emission vào `Li` để làm lửa: `emissionColor * rho`, không phụ thuộc đèn.
- [ ] **Đặt vào scene thật.** Trả về `vec4(L, 1.0 - T)` thay vì tự trộn với `uBackground`, bật `transparent`, `premultipliedAlpha` và tắt `depthWrite` trên material. Volume sẽ phủ lên bất kỳ vật thể nào phía sau.
- [ ] **Hình dạng khác.** Thay hình cầu bằng hộp: viết `intersectBox` (slab method) và sửa `falloff` trong `density`.

### Học tiếp

- Các chương sau của bài viết gốc đi sâu vào đúng ba chủ đề của bước 3, 4, 5, kèm phần toán hình thức.
- **Delta tracking** là phương pháp các renderer production dùng thay ray-marching; nó lấy mẫu ngẫu nhiên thay vì bước đều.
- **Multiple scattering** thay dòng "ánh sáng trời" ở bước 5 bằng mô phỏng thật, và là lý do mây ngoài đời trắng đến vậy.

## Nguồn

- [An Introduction to Volume Rendering, Scratchapixel](https://www.scratchapixel.com/lessons/3d-basic-rendering/volume-rendering-for-developers/intro-volume-rendering.html): bài viết mà tutorial này bám theo.
- Mã nguồn hoàn chỉnh của cả 6 bước: file `volume-tutorial.zip` gửi kèm trong cuộc trò chuyện.
