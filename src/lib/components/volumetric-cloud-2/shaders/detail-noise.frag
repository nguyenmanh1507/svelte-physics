// 3D 32³ RGB: Worley fBm tần số cao → erosion [slide 34]
uniform float uZ, uSize;
out vec4 outColor;
void main() {
  vec3 p = vec3(gl_FragCoord.xy / uSize, uZ);
  outColor = vec4(worleyFbm(p, 2.0, 20.0), worleyFbm(p, 4.0, 23.0), worleyFbm(p, 8.0, 26.0), 1.0);
}
