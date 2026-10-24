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
