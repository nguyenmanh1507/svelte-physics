// Trample map: mỗi texel giữ vector đè cỏ tại một điểm trên mặt đất.
//   rg = hướng cỏ bị đẩy (xz) × độ đè (0 = đứng thẳng, 1 = đè hết cỡ)
// Mỗi frame: làm mờ dần giá trị cũ (cỏ tự đứng dậy), rồi in dấu các vật đang chạm cỏ.
// MAX_INTERACTORS được truyền qua defines.

uniform sampler2D previous;
uniform vec3 area;    // xy = tâm vùng (x, z), z = nửa cạnh vùng (m)
uniform float decay;  // hệ số nhân mỗi frame, < 1
uniform vec4 interactors[MAX_INTERACTORS]; // x, z, bán kính (m), không dùng
uniform int interactorCount;

varying vec2 vUv;

void main() {
  vec2 world = area.xy + (vUv * 2.0 - 1.0) * area.z;
  vec2 bend = texture2D(previous, vUv).rg * decay;

  for (int i = 0; i < MAX_INTERACTORS; i++) {
    if (i >= interactorCount) break;
    vec2 offset = world - interactors[i].xy;
    float d = length(offset);
    float radius = interactors[i].z;
    // đè mạnh nhất trong nửa bán kính, nhạt dần ra mép
    float strength = 1.0 - smoothstep(radius * 0.5, radius, d);
    vec2 push = offset / max(d, 1e-3) * strength; // đẩy ra xa tâm vật
    bend = mix(bend, push, strength);
  }

  gl_FragColor = vec4(bend, 0.0, 1.0);
}
