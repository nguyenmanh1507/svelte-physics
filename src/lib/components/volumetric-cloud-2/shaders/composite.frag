// Composite: bầu trời full-res + mây đã upscale + tonemap. Cần common.glsl + sky.glsl đứng trước.
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uClouds;
uniform mat4 uInvProj, uCamWorld;
uniform vec3 uCamPos, uSunDir;

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  vec3 rd = viewRay(vUv, uInvProj, uCamWorld);

  vec3 oc = uCamPos - vec3(0.0, -EARTH_R, 0.0);
  float b = dot(oc, rd), h = b * b - (dot(oc, oc) - EARTH_R * EARTH_R);
  vec3 col;
  if (h > 0.0 && -b - sqrt(h) > 0.0) {
    float tg = -b - sqrt(h);
    vec3 ground = vec3(0.05, 0.065, 0.05) * (sunColor(uSunDir) * max(uSunDir.y, 0.0) * 2.0 + 0.25);
    col = mix(ground, skyColor(normalize(vec3(rd.x, 0.0, rd.z)), uSunDir), 1.0 - exp(-tg / 9000.0));
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
