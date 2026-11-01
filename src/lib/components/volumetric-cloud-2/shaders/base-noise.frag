// 3D 128³ RGBA: R = Perlin-Worley, GBA = Worley fBm ở 3 tần số tăng dần [slide 33]
uniform float uZ, uSize;
out vec4 outColor;
void main() {
  vec3 p = vec3(gl_FragCoord.xy / uSize, uZ);
  float w4 = worleyFbm(p, 4.0, 0.0);
  float pf = saturate(0.5 + 0.9 * perlinFbm(p, 4.0, 6, 10.0));
  // Perlin "nở ra" bởi Worley → giữ độ liền mạch của Perlin + khối billowy [slide 31]
  float perlinWorley = mix(w4, 1.0, pf);   // = remap(pf, 0, 1, w4, 1)
  perlinWorley = remap01(perlinWorley, 0.5, 0.95, 0.0, 1.0);   // kéo giãn tương phản về [0,1]
  outColor = vec4(perlinWorley, w4, worleyFbm(p, 8.0, 3.0), worleyFbm(p, 16.0, 6.0));
}
