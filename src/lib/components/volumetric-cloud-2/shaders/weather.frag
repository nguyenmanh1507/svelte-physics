// Weather map 2D: R = coverage, G = precipitation, B = cloud type [slide 42]
// Trong game, kênh này đến từ mô phỏng thời tiết; ở đây dùng noise tĩnh.
uniform float uSize;
out vec4 outColor;
void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  float cov    = saturate(0.5 + 1.3 * perlinFbm(vec3(uv, 0.21), 4.0, 5, 40.0));
  float precip = smoothstep(0.08, 0.35, perlinFbm(vec3(uv, 0.53), 2.0, 4, 50.0));
  float type   = saturate(0.5 + 1.2 * perlinFbm(vec3(uv, 0.77), 2.0, 3, 60.0));
  outColor = vec4(cov, precip, type, 1.0);
}
