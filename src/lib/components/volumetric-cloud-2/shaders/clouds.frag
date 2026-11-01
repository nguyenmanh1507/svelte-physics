// Ray march mây (render ở độ phân giải thấp). Cần common.glsl + sky.glsl đứng trước.
in vec2 vUv;
out vec4 outColor;

uniform sampler3D uBase, uDetail;
uniform sampler2D uWeather, uCurl;
uniform mat4 uInvProj, uCamWorld;
uniform vec3 uCamPos, uSunDir, uWind;
uniform float uCoverage, uType, uPrecip, uDensity, uG, uSunIntensity, uAmbient;
uniform bool uUseHG, uUsePowder, uHorizon;

const float CLOUD_BOTTOM = 1500.0;    // [slide 75]
const float CLOUD_TOP    = 4000.0;
const float MAX_DIST     = 60000.0;
const vec3  PLANET_C     = vec3(0.0, -EARTH_R, 0.0);

// Kích thước một ô lặp của từng texture (mét) — tự chọn, chỉnh theo mắt
const float WEATHER_TILE = 40000.0;
const float BASE_TILE    = 9000.0;
const float DETAIL_TILE  = 900.0;
const float CURL_TILE    = 6000.0;
const float CURL_AMOUNT  = 120.0;

const float LIGHT_STEP   = 60.0;
const float RAIN_ABSORB  = 4.0;
const float POWDER_SCALE = 4.0;

// 5 hướng ngẫu nhiên cho nón lấy mẫu ánh sáng
const vec3 CONE[5] = vec3[5](
  vec3( 0.38, -0.62,  0.69), vec3(-0.82,  0.27,  0.50), vec3( 0.18,  0.91, -0.37),
  vec3(-0.34, -0.65, -0.68), vec3( 0.85,  0.16, -0.50));

vec2 raySphere(vec3 ro, vec3 rd, float r) {
  vec3 oc = ro - PLANET_C;
  float b = dot(oc, rd);
  float c = dot(oc, oc) - r * r;
  float h = b * b - c;
  if (h < 0.0) return vec2(-1.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}

float heightFrac(vec3 p) {
  return (length(p - PLANET_C) - EARTH_R - CLOUD_BOTTOM) / (CLOUD_TOP - CLOUD_BOTTOM);
}

// ---------- Modeling ----------

// type: 0 = stratus, 0.5 = cumulus, 1 = cumulonimbus [slide 36]
float heightGradient(float h, float type) {
  float stratus = remap01(h, 0.0, 0.08, 0.0, 1.0) * remap01(h, 0.15, 0.25, 1.0, 0.0);
  float cumulus = remap01(h, 0.0, 0.15, 0.0, 1.0) * remap01(h, 0.4, 0.65, 1.0, 0.0);
  float cb      = remap01(h, 0.0, 0.1, 0.0, 1.0)  * remap01(h, 0.75, 1.0, 1.0, 0.0);
  float a = mix(stratus, cumulus, saturate(type * 2.0));
  return mix(a, cb, saturate(type * 2.0 - 1.0));
}

// trả về (coverage, precip, type)
vec3 getWeather(vec3 p) {
  vec3 w = texture(uWeather, (p.xz - uWind.xz) / WEATHER_TILE).rgb;
  float cov    = saturate(w.r + (uCoverage - 0.5) * 2.0);
  float precip = uPrecip * w.g;
  float type   = saturate(uType + (w.b - 0.5) * 0.6);

  if (uHorizon) {  // từ 15 km: chuyển dần sang cumulus ~50% coverage [slide 47]
    float far = remap01(length(p.xz - uCamPos.xz), 15000.0, 35000.0, 0.0, 1.0);
    cov  = mix(cov, max(cov, 0.5), far);
    type = mix(type, 0.5, far);
  }
  // mưa đẩy về cumulonimbus ở 70% coverage [slide 44]
  cov  = mix(cov, max(cov, 0.7), precip);
  type = mix(type, 1.0, precip);
  return vec3(cov, precip, type);
}

float sampleDensity(vec3 p, vec3 w, bool cheap) {
  float h = heightFrac(p);
  if (h < 0.0 || h > 1.0) return 0.0;

  // 1. Base shape × height gradient [slide 37]
  vec4 b = texture(uBase, (p - uWind) / BASE_TILE);
  float fbm  = dot(b.gba, vec3(0.625, 0.25, 0.125));
  float base = remap01(b.r, fbm - 1.0, 1.0, 0.0, 1.0);
  base *= heightGradient(h, w.z);

  // 2. Coverage + giảm mật độ ở đáy [slide 37-38]
  float d = remap01(base, 1.0 - w.x, 1.0, 0.0, 1.0) * w.x;
  d *= remap01(h, 0.0, 0.2, 0.25, 1.0);
  if (cheap || d <= 0.0) return d;

  // 3. Erosion bằng detail, méo bởi curl noise [slide 39]
  vec2 curl = texture(uCurl, p.xz / CURL_TILE).rg * 2.0 - 1.0;
  vec3 pd = p - uWind * 1.15 + vec3(curl.x, 0.0, curl.y) * CURL_AMOUNT * (1.0 - h);
  float detail = dot(texture(uDetail, pd / DETAIL_TILE).rgb, vec3(0.625, 0.25, 0.125));
  // texture lưu Worley đảo (billowy) → đảo lại ở đáy cho ra wispy
  float erode = mix(1.0 - detail, detail, saturate(h * 10.0));
  return remap01(d, erode * 0.35, 1.0, 0.0, 1.0);
}

// ---------- Lighting ----------

// 5 mẫu hình nón + 1 mẫu xa = 6 [slide 85-86]
float lightOpticalDepth(vec3 p, vec3 w, bool cheap) {
  float od = 0.0;
  for (int i = 0; i < 5; i++) {
    float s = LIGHT_STEP * (float(i) + 1.0);
    vec3 q = p + uSunDir * s + CONE[i] * s * 0.35;
    od += sampleDensity(q, w, cheap) * LIGHT_STEP;   // dùng weather tại p cho mẫu gần (rẻ hơn)
  }
  vec3 qFar = p + uSunDir * 1500.0;                   // mẫu xa: bắt bóng của mây xa
  od += sampleDensity(qFar, getWeather(qFar), true) * LIGHT_STEP * 4.0;
  return od * uDensity;
}

float henyeyGreenstein(float cosT, float g) {
  float g2 = g * g;
  return (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * cosT, 1.5);  // chuẩn hoá để đẳng hướng = 1
}

// Energy = e^(-d·r) · HG · P   [slide 71, 87]
// od     = optical depth về phía mặt trời (tổng 6 light sample)
// dLocal = mật độ tại điểm đang xét
float lightEnergy(float od, float dLocal, float cosT, float precip) {
  float r      = mix(1.0, RAIN_ABSORB, precip);       // mây mưa hấp thụ nhiều hơn [slide 70]
  float beer   = exp(-od * r);                        // [slide 54]
  // Powder 1 - e^(-2d) [slide 64]. Slide không nói rõ "d" là depth nào. Dùng optical depth
  // về phía mặt trời thì mặt hướng nắng (od ≈ 0) bị đen hoàn toàn, nên demo dùng mật độ
  // tại chỗ: rìa mỏng tối hơn, lõi dày sáng hơn — đúng hiệu ứng "powdered sugar".
  float powder = 1.0 - exp(-2.0 * dLocal * POWDER_SCALE);
  // Powder phụ thuộc hướng nhìn, rõ nhất khi quay lưng về mặt trời [slide 68-69].
  // Cách trộn này là tự chọn — slide không cho công thức.
  float P = uUsePowder ? mix(1.0, powder, saturate(0.5 - 0.5 * cosT)) : 1.0;
  float phase = uUseHG ? henyeyGreenstein(cosT, uG) : 1.0;
  return beer * P * phase;
}

// ---------- Ray march ----------

float ign(vec2 px) {  // interleaved gradient noise để jitter điểm bắt đầu
  return fract(52.9829189 * fract(dot(px, vec2(0.06711056, 0.00583715))));
}

vec4 march(vec3 ro, vec3 rd, float tMin, float tMax, out float cloudDepth) {
  // 64 mẫu khi nhìn lên, tới 128 ở chân trời [slide 83]
  float maxSteps   = mix(128.0, 64.0, saturate(rd.y * 2.0));
  float fineStep   = (tMax - tMin) / maxSteps;
  float coarseStep = fineStep * 3.0;                  // bước rẻ dài hơn [slide 80]
  float cosT = dot(rd, uSunDir);

  vec3 sunC   = sunColor(uSunDir) * uSunIntensity;
  vec3 ambTop = skyColor(vec3(0.0, 1.0, 0.0), uSunDir);
  vec3 ambBot = skyColor(normalize(vec3(1.0, 0.05, 0.0)), uSunDir) * 0.5;

  float t = tMin + fineStep * ign(gl_FragCoord.xy);
  vec3  col = vec3(0.0);
  float T = 1.0, depthSum = 0.0, wSum = 0.0;
  bool  fine = false;
  int   zeroCount = 0;

  for (int i = 0; i < 400; i++) {
    if (t >= tMax) break;
    vec3 p = ro + rd * t;
    vec3 w = getWeather(p);

    if (!fine) {
      // bước rẻ: chỉ base shape, nhảy qua vùng trống
      if (sampleDensity(p, w, true) > 0.0) {
        fine = true;
        zeroCount = 0;
        t = max(t - coarseStep, tMin);                // lùi 1 bước trước khi vào chế độ chi tiết [slide 80]
      } else {
        t += coarseStep;
      }
      continue;
    }

    float d = sampleDensity(p, w, false);
    if (d > 0.0) {
      zeroCount = 0;
      bool cheapLight = (1.0 - T) > 0.3;              // alpha > 0.3 → light sample rẻ [slide 86]
      float od = lightOpticalDepth(p, w, cheapLight);
      float h  = heightFrac(p);
      vec3 S = sunC * lightEnergy(od, d, cosT, w.y)
             + mix(ambBot, ambTop, h) * uAmbient * (1.0 - 0.6 * w.y);   // ambient tăng theo độ cao [slide 90]

      float stepT = exp(-d * uDensity * fineStep);
      float a = T * (1.0 - stepT);
      col += a * S;                                   // tích phân bảo toàn năng lượng (ngoài slide)
      depthSum += a * t; wSum += a;
      T *= stepT;
      if (T < 0.01) break;                            // alpha ~1 → dừng sớm [slide 81]
    } else if (++zeroCount > 8) {                     // nhiều mẫu rỗng liên tiếp → về bước rẻ [slide 82]
      fine = false;
    }
    t += fineStep;
  }
  cloudDepth = wSum > 0.0 ? depthSum / wSum : tMax;
  return vec4(col, T);
}

// Đoạn tia [tMin, tMax] nằm trong tầng mây, camera ở độ cao bất kỳ (camera bay tự do).
// Chỉ lấy đoạn đầu tiên: nhìn xuyên qua tầng mây rồi ra lại phía bên kia thì bỏ qua.
vec2 cloudSegment(vec3 ro, vec3 rd) {
  vec2 top    = raySphere(ro, rd, EARTH_R + CLOUD_TOP);
  vec2 bottom = raySphere(ro, rd, EARTH_R + CLOUD_BOTTOM);
  float r = length(ro - PLANET_C);
  float tMin, tMax;
  if (r < EARTH_R + CLOUD_BOTTOM) {          // dưới tầng mây: từ đáy lên tới đỉnh
    tMin = bottom.y;
    tMax = top.y;
  } else {
    // trong tầng mây: bắt đầu tại camera; trên tầng mây: từ lúc chạm đỉnh (nếu có)
    tMin = r <= EARTH_R + CLOUD_TOP ? 0.0 : (top.x > 0.0 ? top.x : -1.0);
    if (tMin < 0.0) return vec2(-1.0);
    tMax = bottom.x > 0.0 ? bottom.x : top.y;  // chúi xuống thì dừng ở đáy tầng mây
  }
  // mặt đất chắn tia (nhìn từ trên xuống thì mây vẫn nằm trước mặt đất)
  float ground = raySphere(ro, rd, EARTH_R).x;
  if (ground > 0.0) tMax = min(tMax, ground);
  return vec2(tMin, min(tMax, MAX_DIST));
}

void main() {
  vec3 rd = viewRay(vUv, uInvProj, uCamWorld);
  vec3 ro = uCamPos;

  vec2 seg = cloudSegment(ro, rd);
  float tMin = seg.x, tMax = seg.y;
  if (tMin < 0.0 || tMin >= tMax) { outColor = vec4(0, 0, 0, 1); return; }

  float depth;
  vec4 c = march(ro, rd, tMin, tMax, depth);

  // Mây xa nhạt dần vào màu khí quyển theo depth [slide 90]; công thức tự chọn
  float fog = 1.0 - exp(-pow(depth / 45000.0, 2.0));
  c.rgb = mix(c.rgb, skyColor(rd, uSunDir) * (1.0 - c.a), fog);
  outColor = c;   // rgb = màu (premultiplied), a = transmittance
}
