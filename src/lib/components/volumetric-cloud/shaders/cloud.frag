// Mây thể tích đặt trong một scene thật (không phải nền phẳng như tutorial).
// Mỗi đám mây là một hộp; shader ray-march bên trong hộp rồi trả về màu đã nhân
// alpha (premultiplied), để mây phủ lên mọi thứ phía sau qua alpha blending.
// Mô hình ánh sáng giống bước 5 của tutorial; noise lấy từ noise.glsl.

uniform vec3 uCenter;               // tâm hộp, world
uniform vec3 uHalfSize;             // nửa kích thước hộp, world
uniform vec4 uBlobs[MAX_BLOBS];     // xyz: tâm blob trong hộp (-1..1), w: bán kính world
uniform int uBlobCount;
uniform vec3 uSquash;               // ép blob theo trục: > 1 làm dẹt theo trục đó
uniform float uBase;                // chân mây trong hộp: dưới mức này bị cắt phẳng
uniform float uErosion;             // noise ăn mòn mép mạnh tới đâu
uniform vec3 uStretch;              // co giãn noise theo trục (vệt mây tầng)
uniform vec3 uSeed;
uniform float uDensity;             // hệ số tán xạ ở chỗ đặc nhất, trên mỗi world unit
uniform float uFade;                // 0..1, để mây mờ dần khi trôi ra rìa vùng

uniform vec3 uLightDir;             // hướng TỚI mặt trời, đã chuẩn hoá
uniform vec3 uLightColor;
uniform vec3 uSkyColor;             // ánh sáng trời chiếu từ trên xuống
uniform vec3 uGroundColor;          // ánh sáng hắt lên từ mặt đất
uniform float uDetail;              // tần số noise, 1/world unit
uniform float uTime;
uniform int uSteps;
uniform int uLightSteps;

uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;

varying vec3 vWorldPos;

const float PI = 3.14159265359;

// Giao tia với hộp [-1, 1]^3 (slab method). rd không cần chuẩn hoá:
// t trả về theo đúng đơn vị của rd, ở đây là world unit.
bool intersectBox(vec3 ro, vec3 rd, out float t0, out float t1) {
  vec3 inv = 1.0 / rd;
  vec3 a = (-1.0 - ro) * inv;
  vec3 b = (1.0 - ro) * inv;
  vec3 tmin = min(a, b);
  vec3 tmax = max(a, b);
  t0 = max(max(tmin.x, tmin.y), tmin.z);
  t1 = min(min(tmax.x, tmax.y), tmax.z);
  if (t1 < max(t0, 0.0)) return false;
  t0 = max(t0, 0.0); // camera nằm trong hộp
  return true;
}

float phaseHG(float cosTheta, float g) {
  float g2 = g * g;
  float denom = 1.0 + g2 - 2.0 * g * cosTheta;
  return (1.0 - g2) / (4.0 * PI * pow(denom, 1.5));
}

// fbm rút gọn 2 lớp cho tia về phía mặt trời: bóng trong mây không cần chi tiết.
float fbmLow(vec3 p) {
  return 0.5 * noise(p) + 0.25 * noise(p * 2.0);
}

// Hình khối thô của đám mây (0..1), chưa có noise. p là toạ độ trong hộp.
float shape(vec3 p) {
  float f = 0.0;
  for (int i = 0; i < MAX_BLOBS; i++) {
    if (i >= uBlobCount) break;
    vec4 b = uBlobs[i];
    float d = length((p - b.xyz) * uHalfSize * uSquash) / b.w; // 0 ở tâm, 1 ở mặt blob
    float v = 1.0 - d;
    // hợp mềm: hai blob gần nhau dính thành một khối liền, không có rãnh
    float h = max(0.35 - abs(f - v), 0.0) / 0.35;
    f = max(f, v) + h * h * 0.35 * 0.25;
  }
  f *= smoothstep(uBase, uBase + 0.2, p.y);          // chân mây phẳng
  vec3 q = abs(p);
  f *= 1.0 - smoothstep(0.8, 1.0, max(q.x, q.z));    // không để lộ thành hộp
  f *= 1.0 - smoothstep(0.85, 1.0, q.y);
  return f;
}

// Mật độ 0..1. Sâu trong khối thì đặc; càng ra mép, noise càng khoét mạnh,
// tạo thành các cụm bông có viền rõ thay vì một mặt cầu trơn.
// w là toạ độ world tương đối so với tâm mây, để noise trôi cùng mây.
float density(vec3 p, vec3 w, bool low) {
  float s = shape(p);
  if (s <= 0.0) return 0.0;
  vec3 q = w * uStretch * uDetail + uSeed + vec3(0.0, uTime * 0.03, uTime * 0.02);
  float n = low ? fbmLow(q) / 0.75 : fbm(q) / 0.94;
  n = smoothstep(0.2, 0.8, n); // tăng tương phản: fbm thường chỉ quanh 0.3..0.7
  return smoothstep(0.0, 0.2, s * 1.4 - (1.0 - n) * uErosion) * uFade;
}

// Optical depth từ điểm p tới chỗ tia về phía mặt trời ra khỏi hộp.
float lightOpticalDepth(vec3 p, vec3 w, float jitter) {
  vec3 dirLocal = uLightDir / uHalfSize;
  float l0, l1;
  intersectBox(p, dirLocal, l0, l1);
  float dl = l1 / float(uLightSteps);
  float tau = 0.0;
  for (int j = 0; j < uLightSteps; j++) {
    float s = (float(j) + jitter) * dl;
    tau += density(p + dirLocal * s, w + uLightDir * s, true) * dl;
  }
  return tau * uDensity;
}

void main() {
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWorldPos - cameraPosition);

  // Đổi tia sang hệ toạ độ hộp; t vẫn là khoảng cách world dọc tia.
  vec3 roLocal = (ro - uCenter) / uHalfSize;
  vec3 rdLocal = rd / uHalfSize;
  float t0, t1;
  if (!intersectBox(roLocal, rdLocal, t0, t1)) discard;

  // Mây ở xa dùng ít bước hơn: chúng nhỏ trên màn hình và đã bị sương làm mờ.
  int steps = int(mix(float(uSteps), float(uSteps) * 0.5, smoothstep(250.0, 700.0, t0)));
  float dx = (t1 - t0) / float(steps);

  float cosTheta = dot(rd, uLightDir);
  // hai thuỳ: viền bạc khi nhìn ngược nắng + một chút tán xạ ngược
  float phase = mix(phaseHG(cosTheta, 0.6), phaseHG(cosTheta, -0.3), 0.3);
  // lệch điểm bắt đầu theo pixel để giấu vân sọc (interleaved gradient noise
  // thì lại tạo sọc chéo vì quá đều, hash cho hạt nhiễu dễ chịu hơn)
  float jitter = hash(vec3(gl_FragCoord.xy, 1.0));

  float T = 1.0;
  vec3 L = vec3(0.0);
  float depth = 0.0;  // khoảng cách trung bình (theo độ đục) để tính sương

  for (int i = 0; i < 128; i++) {
    if (i >= steps) break;
    float t = t0 + (float(i) + jitter) * dx;
    vec3 p = roLocal + rdLocal * t;
    vec3 w = ro + rd * t - uCenter;
    float rho = density(p, w, false);
    if (rho <= 0.003) continue;

    float sigma = uDensity * rho;
    float tau = lightOpticalDepth(p, w, jitter);
    // "powder": mép mỏng phía mặt trời không sáng rực, cho mây có khối
    float powder = 1.0 - exp(-2.0 * sigma * 6.0);
    vec3 sun = uLightColor * exp(-tau) * phase * mix(0.5, 1.0, powder);
    // ánh sáng môi trường: đỉnh mây nhận trời, đáy mây nhận màu đất
    float h = clamp(p.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 ambient = mix(uGroundColor, uSkyColor, h);

    // tích phân giải tích trên đoạn dx (ổn định hơn cộng Riemann khi mây đặc)
    float Tstep = exp(-sigma * dx);
    L += T * (sun + ambient) * (1.0 - Tstep);
    depth += T * (1.0 - Tstep) * t;
    T *= Tstep;
    if (T < 0.02) break;
  }

  float alpha = 1.0 - T;
  if (alpha < 0.003) discard;

  // Sương giống THREE.Fog của scene: mây xa nhạt dần về màu nền.
  float fog = smoothstep(uFogNear, uFogFar, depth / alpha);
  vec3 color = mix(L / alpha, uFogColor, fog);
  color = color / (1.0 + 0.15 * color); // nén nhẹ phần cháy sáng ở viền bạc

  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
  gl_FragColor.rgb *= alpha; // premultiplied alpha
}
