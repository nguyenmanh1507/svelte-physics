// Một lá cỏ mỗi instance. Không có attribute: vị trí đỉnh suy ra từ gl_VertexID,
// vị trí lá suy ra từ gl_InstanceID. Cần common.glsl, noise.glsl, terrain.glsl đứng trước.
//
// Mỗi lá có 2 mặt, mỗi mặt (segments + 1) * 2 đỉnh:
//   vertID chẵn = mép trái, lẻ = mép phải; vertFB_ID >= GRASS_VERTICES là mặt sau.

uniform vec4 grassParams; // x = segments, y = nửa cạnh vùng cỏ, z = rộng lá, w = cao lá
uniform vec2 windParams;  // x = độ nghiêng do gió, y = thời gian gió (đã nhân tốc độ)
uniform sampler2D tileDataTexture;

varying vec4 vGrassData; // x, heightPercent, xSide, grassType
varying vec3 vNormal;
varying vec3 vWorldPosition;

// Based on Austin Appleby's public-domain MurmurHash2.
// https://github.com/aappleby/smhasher/blob/master/src/MurmurHash2.cpp
// Adapted for GLSL and fixed-size inputs; existing output ranges preserved.
uvec2 murmurHash21(uint src) {
  const uint M = 0x5bd1e995u;
  uvec2 h = uvec2(1190494759u, 2147483647u);
  uint k0 = src * M; k0 = (k0 ^ (k0 >> 24u)) * M; h = (h * M) ^ k0;
  h = (h ^ (h >> 13u)) * M; return h ^ (h >> 15u);
}

// 2 outputs, 1 input, trong [0, 1)
vec2 hash21(float src) {
  uvec2 bits = murmurHash21(floatBitsToUint(src));
  return vec2(bits & 0x007fffffu) * (1.0 / 8388608.0);
}

mat3 rotateY(float theta) {
  float c = cos(theta);
  float s = sin(theta);
  return mat3(
    vec3(c, 0, s),
    vec3(0, 1, 0),
    vec3(-s, 0, c));
}

mat3 rotateAxis(vec3 axis, float angle) {
  float s = sin(angle);
  float c = cos(angle);
  float oc = 1.0 - c;
  return mat3(
    oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,
    oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,
    oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c);
}

vec3 bezier(vec3 P0, vec3 P1, vec3 P2, vec3 P3, float t) {
  return (1.0 - t) * (1.0 - t) * (1.0 - t) * P0 +
         3.0 * (1.0 - t) * (1.0 - t) * t * P1 +
         3.0 * (1.0 - t) * t * t * P2 +
         t * t * t * P3;
}

vec3 bezierGrad(vec3 P0, vec3 P1, vec3 P2, vec3 P3, float t) {
  return 3.0 * (1.0 - t) * (1.0 - t) * (P1 - P0) +
         6.0 * (1.0 - t) * t * (P2 - P1) +
         3.0 * t * t * (P3 - P2);
}

const float PI = 3.14159;

void main() {
  int GRASS_SEGMENTS = int(grassParams.x);
  int GRASS_VERTICES = (GRASS_SEGMENTS + 1) * 2;
  float GRASS_PATCH_SIZE = grassParams.y;
  float GRASS_WIDTH = grassParams.z;
  float GRASS_HEIGHT = grassParams.w;
  float windLean = windParams.x;
  float windTime = windParams.y;

  // ---------- Vị trí lá cỏ ----------
  vec2 hashedInstanceID = hash21(float(gl_InstanceID)) * 2.0 - 1.0;
  vec3 grassOffset = vec3(hashedInstanceID.x, 0.0, hashedInstanceID.y) * GRASS_PATCH_SIZE;
  grassOffset = terrainHeight(grassOffset);

  vec3 grassBladeWorldPos = (modelMatrix * vec4(grassOffset, 1.0)).xyz;
  vec3 hashVal = hash(grassBladeWorldPos);

  // 2 loại lá trong texture array, loại 1 cao hơn
  float grassType = saturate(hashVal.z) > 0.75 ? 1.0 : 0.0;
  float angle = remap(hashVal.x, -1.0, 1.0, -PI, PI);

  // tile data: vùng sáng = lối đi, cỏ thấp / không có cỏ
  vec4 tileData = texture2D(
      tileDataTexture,
      vec2(-grassBladeWorldPos.x, grassBladeWorldPos.z) / GRASS_PATCH_SIZE * 0.5 + 0.5);
  float tileGrassHeight = (1.0 - tileData.x) * mix(1.0, 1.5, grassType);

  // ---------- Đỉnh trong lá ----------
  int vertFB_ID = gl_VertexID % (GRASS_VERTICES * 2);
  int vertID = vertFB_ID % GRASS_VERTICES;

  int xTest = vertID & 0x1; // 0 = trái, 1 = phải
  int zTest = (vertFB_ID >= GRASS_VERTICES) ? 1 : -1; // mặt trước / sau
  float xSide = float(xTest);
  float zSide = float(zTest);
  float heightPercent = float(vertID - xTest) / (float(GRASS_SEGMENTS) * 2.0);

  float width = GRASS_WIDTH;
  float height = GRASS_HEIGHT * tileGrassHeight;
  float x = (xSide - 0.5) * width;

  // ---------- Gió ----------
  float windStrength = noise(vec3(grassBladeWorldPos.xz * 0.05, 0.0) + windTime);
  float windAngle = 0.0;
  vec3 windAxis = vec3(cos(windAngle), 0.0, sin(windAngle));
  float windLeanAngle = windStrength * windLean * heightPercent;

  float randomLeanAnimation = noise(
      vec3(grassBladeWorldPos.xz, windTime * 4.0)) * (windStrength * 0.5 + 0.125);
  float leanFactor = remap(hashVal.y, -1.0, 1.0, -0.5, 0.5) + randomLeanAnimation;

  // ---------- Uốn lá theo đường cong bezier ----------
  vec3 p1 = vec3(0.0);
  vec3 p2 = vec3(0.0, 0.33, 0.0);
  vec3 p3 = vec3(0.0, 0.66, 0.0);
  vec3 p4 = vec3(0.0, cos(leanFactor), sin(leanFactor));
  vec3 curve = bezier(p1, p2, p3, p4, heightPercent);

  vec3 curveGrad = bezierGrad(p1, p2, p3, p4, heightPercent);
  mat2 curveRot90 = mat2(0.0, 1.0, -1.0, 0.0) * -zSide;

  float y = curve.y * height;
  float z = curve.z * height;

  mat3 grassMat = rotateAxis(windAxis, windLeanAngle) * rotateY(angle);

  vec3 grassLocalPosition = grassMat * vec3(x, y, z) + grassOffset;
  vec3 grassLocalNormal = grassMat * vec3(0.0, curveRot90 * curveGrad.yz);

  // xa camera thì pháp tuyến ngả dần lên trời cho ánh sáng mịn hơn
  float distanceBlend = smoothstep(0.0, 10.0, distance(cameraPosition, grassBladeWorldPos));
  grassLocalNormal = mix(grassLocalNormal, vec3(0.0, 1.0, 0.0), distanceBlend * 0.5);
  grassLocalNormal = normalize(grassLocalNormal);

  // ---------- Làm dày lá khi nhìn nghiêng (view space) ----------
  vec4 mvPosition = modelViewMatrix * vec4(grassLocalPosition, 1.0);

  vec3 viewDir = normalize(cameraPosition - grassBladeWorldPos);
  vec3 grassFaceNormal = (grassMat * vec3(0.0, 0.0, -zSide));

  float viewDotNormal = saturate(dot(grassFaceNormal, viewDir));
  float viewSpaceThickenFactor = easeOut(
      1.0 - viewDotNormal, 4.0) * smoothstep(0.0, 0.2, viewDotNormal);

  mvPosition.x += viewSpaceThickenFactor * (xSide - 0.5) * width * 0.5 * -zSide;

  gl_Position = projectionMatrix * mvPosition;
  // lá quá thấp (trên lối đi) -> w = 0 để GPU loại bỏ
  gl_Position.w = tileGrassHeight < 0.25 ? 0.0 : gl_Position.w;

  vNormal = normalize((modelMatrix * vec4(grassLocalNormal, 0.0)).xyz);
  vWorldPosition = (modelMatrix * vec4(grassLocalPosition, 1.0)).xyz;
  vGrassData = vec4(x, heightPercent, xSide, grassType);
}
