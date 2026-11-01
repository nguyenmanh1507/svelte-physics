// 2D 128²: curl noise (không phân kỳ) để làm méo detail [slide 35]
uniform float uSize;
out vec4 outColor;
float N(vec2 uv) { return perlinFbm(vec3(uv, 0.37), 4.0, 4, 70.0); }
void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  float e = 1.0 / uSize;
  float dx = (N(uv + vec2(e, 0)) - N(uv - vec2(e, 0))) / (2.0 * e);
  float dy = (N(uv + vec2(0, e)) - N(uv - vec2(0, e))) / (2.0 * e);
  vec2 curl = vec2(dy, -dx) * 0.12;
  outColor = vec4(curl * 0.5 + 0.5, 0.5, 1.0);
}
