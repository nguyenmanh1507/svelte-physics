// Bầu trời đơn giản (không phải scattering vật lý) — chỉ để làm nền + ambient
vec3 sunColor(vec3 s) {
  return mix(vec3(1.0, 0.38, 0.14), vec3(1.0, 0.96, 0.9), smoothstep(-0.02, 0.4, s.y))
       * smoothstep(-0.08, 0.02, s.y);
}

vec3 skyColor(vec3 rd, vec3 s) {
  float day = smoothstep(-0.06, 0.35, s.y);
  vec3 zen = mix(vec3(0.015, 0.02, 0.05), vec3(0.16, 0.34, 0.72), day);
  vec3 hor = mix(vec3(0.55, 0.32, 0.24), vec3(0.62, 0.74, 0.9), day) * (0.08 + 0.92 * smoothstep(-0.1, 0.05, s.y));
  vec3 c = mix(hor, zen, pow(saturate(rd.y), 0.45));
  float mu = saturate(dot(rd, s));
  c += sunColor(s) * (pow(mu, 6.0) * 0.22 + pow(mu, 64.0) * 0.35);
  return c;
}

// Hướng tia nhìn từ toạ độ màn hình
vec3 viewRay(vec2 uv, mat4 invProj, mat4 camWorld) {
  vec4 v = invProj * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
  return normalize((camWorld * vec4(v.xyz / v.w, 0.0)).xyz);
}
