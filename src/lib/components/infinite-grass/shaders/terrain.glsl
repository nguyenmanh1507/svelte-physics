// Độ cao địa hình, dùng chung cho mặt đất và gốc cỏ để cỏ luôn mọc đúng trên mặt đất.
// Cần noise.glsl đứng trước.
uniform vec2 terrainParams; // x = tần số noise, y = biên độ (m)

vec3 terrainHeight(vec3 worldPos) {
  return vec3(worldPos.x, noise(worldPos * terrainParams.x) * terrainParams.y, worldPos.z);
}
