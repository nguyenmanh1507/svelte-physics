// Composite: bầu trời full-res + mây đã upscale + tonemap. Cần common.glsl + sky.glsl đứng trước.
// Có `#define OCEAN` thì mặt đất thành biển (phía -Z) + bãi cát + đất liền (phía +Z).
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uClouds;
uniform mat4 uInvProj, uCamWorld;
uniform vec3 uCamPos, uSunDir;

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

#ifdef OCEAN
uniform float uTime, uShoreZ;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x),
             mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}

// Mép nước chạy dọc trục X, hơi lượn
float shoreLine(float x) {
  return uShoreZ + 18.0 * sin(x * 0.0045) + 9.0 * sin(x * 0.013 + 1.7);
}

// Gradient độ cao mặt biển (tổng sóng sin, mỗi sóng tắt dần theo khoảng cách để khỏi răng cưa)
vec2 waveGradient(vec2 p, float dist) {
  const int N = 6;
  const vec2 DIRS[N] = vec2[N](
    vec2(0.20, 1.00), vec2(-0.45, 0.90), vec2(0.70, 0.70),
    vec2(-0.10, 1.00), vec2(0.95, 0.30), vec2(-0.80, 0.60));
  const float LEN[N] = float[N](23.0, 13.0, 7.3, 4.1, 2.6, 1.7);
  vec2 g = vec2(0.0);
  for (int i = 0; i < N; i++) {
    vec2 d = normalize(DIRS[i]);
    float k = 6.2832 / LEN[i];
    float w = sqrt(9.81 * k);                  // quan hệ tán sắc nước sâu
    float a = 0.035 * LEN[i] * 0.16;           // độ dốc ~ hằng số
    float fade = exp(-dist / (LEN[i] * 40.0));
    g += d * (a * k * cos(dot(d, p) * k - w * uTime) * fade);
  }
  return g;
}

vec3 shadeOcean(vec3 p, vec3 rd, float dist, float fromShore) {
  vec2 g = waveGradient(p.xz, dist);
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
  float cosV = max(dot(n, -rd), 0.0);
  float fresnel = 0.02 + 0.98 * pow(1.0 - cosV, 5.0);

  vec3 r = reflect(rd, n);
  r.y = abs(r.y);
  vec3 refl = skyColor(r, uSunDir);
  float mu = max(dot(r, uSunDir), 0.0);
  vec3 sun = sunColor(uSunDir);
  vec3 spec = sun * (pow(mu, 900.0) * 60.0 + pow(mu, 90.0) * 0.6);

  // nước nông ngả ngọc lam, xa bờ xanh thẫm
  float shallow = exp(-fromShore / 30.0);
  vec3 body = mix(vec3(0.006, 0.05, 0.085), vec3(0.04, 0.30, 0.32), shallow);
  body *= sun * max(uSunDir.y, 0.0) * 1.2 + vec3(0.35, 0.45, 0.55);

  vec3 col = mix(body, refl, fresnel) + spec;

  // bọt trắng ở mép nước, xô vào bờ theo thời gian
  float surf = 2.5 + 1.5 * sin(uTime * 0.7 + p.x * 0.05);
  float foam = smoothstep(surf, 0.0, fromShore) * (0.6 + 0.4 * valueNoise(p.xz * 0.8 + uTime * 0.3));
  return mix(col, vec3(0.9) * (sun * max(uSunDir.y, 0.0) + 0.4), foam * 0.85);
}

vec3 shadeLand(vec3 p, float fromShore) {
  float n = valueNoise(p.xz * 0.15) * 0.6 + valueNoise(p.xz * 0.9) * 0.4;
  vec3 wetSand = vec3(0.36, 0.31, 0.23);
  vec3 sand = vec3(0.58, 0.51, 0.38) * (0.92 + 0.12 * n);
  vec3 grass = mix(vec3(0.16, 0.26, 0.10), vec3(0.24, 0.32, 0.14), n);
  vec3 albedo = mix(wetSand, sand, smoothstep(0.0, 6.0, fromShore));
  albedo = mix(albedo, grass, smoothstep(55.0, 120.0, fromShore));
  return albedo * (sunColor(uSunDir) * max(uSunDir.y, 0.0) * 2.0 + 0.3);
}
#endif

void main() {
  vec3 rd = viewRay(vUv, uInvProj, uCamWorld);

  vec3 oc = uCamPos - vec3(0.0, -EARTH_R, 0.0);
  float b = dot(oc, rd), h = b * b - (dot(oc, oc) - EARTH_R * EARTH_R);
  vec3 col;
  if (h > 0.0 && -b - sqrt(h) > 0.0) {
    float tg = -b - sqrt(h);
#ifdef OCEAN
    vec3 p = uCamPos + rd * tg;
    float d = shoreLine(p.x) - p.z;   // > 0: ngoài biển
    vec3 ground = d > 0.0 ? shadeOcean(p, rd, tg, d) : shadeLand(p, -d);
    col = mix(ground, skyColor(normalize(vec3(rd.x, 0.0, rd.z)), uSunDir), 1.0 - exp(-tg / 14000.0));
#else
    vec3 ground = vec3(0.05, 0.065, 0.05) * (sunColor(uSunDir) * max(uSunDir.y, 0.0) * 2.0 + 0.25);
    col = mix(ground, skyColor(normalize(vec3(rd.x, 0.0, rd.z)), uSunDir), 1.0 - exp(-tg / 9000.0));
#endif
  } else {
    col = skyColor(rd, uSunDir);
    float mu = dot(rd, uSunDir);
    col += sunColor(uSunDir) * 30.0 * smoothstep(0.99994, 0.99997, mu);   // đĩa mặt trời
  }

  vec4 clouds = texture(uClouds, vUv);   // rgb = màu (premultiplied), a = transmittance
  col = col * clouds.a + clouds.rgb;

  col = aces(col * 1.1);
  outColor = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
}
