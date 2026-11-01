// Lưới kiểu "prototype": ô 1 m có độ sáng ngẫu nhiên, vạch lưới 1 m và 10 m.
// Cần common.glsl đứng trước.
uniform sampler2D diffuseTexture;

varying vec3 vWorldPosition;

// ~[-1, 1]
float hash12(vec2 p) {
  p = 50.0 * fract(p * 0.3183099 + vec2(0.71, 0.113));
  return -1.0 + 2.0 * fract(p.x * p.y * (p.x + p.y));
}

void main() {
  float grid1 = texture2D(diffuseTexture, vWorldPosition.xz * 0.1).r;
  float grid2 = texture2D(diffuseTexture, vWorldPosition.xz * 1.0).r;

  float gridHash1 = hash12(floor(vWorldPosition.xz * 1.0));

  vec3 colour = mix(
      vec3(0.5 + remap(gridHash1, -1.0, 1.0, -0.2, 0.2)),
      vec3(0.0625),
      grid2);
  colour = mix(colour, vec3(0.00625), grid1);

  gl_FragColor = vec4(pow(colour, vec3(1.0 / 2.2)), 1.0);
}
