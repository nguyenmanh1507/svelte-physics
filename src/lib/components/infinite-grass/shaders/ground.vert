// Mặt phẳng lưới dày, nâng theo địa hình. Cần noise.glsl, terrain.glsl đứng trước.
varying vec3 vWorldPosition;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  worldPosition.xyz = terrainHeight(worldPosition.xyz);

  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
