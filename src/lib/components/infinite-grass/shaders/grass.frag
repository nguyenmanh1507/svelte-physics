// Cần common.glsl đứng trước.
uniform sampler2DArray grassDiffuse;

varying vec4 vGrassData; // x, heightPercent, xSide, grassType
varying vec3 vNormal;
varying vec3 vWorldPosition;

const vec3 LIGHT_DIR = vec3(-0.6667, 0.3333, 0.6667); // normalize(-1, 0.5, 1)
const vec3 HEMI_SKY = vec3(1.0, 1.0, 0.75);
const vec3 HEMI_GROUND = vec3(0.05, 0.05, 0.25);

vec3 hemiLight(vec3 normal, vec3 groundColour, vec3 skyColour) {
  return mix(groundColour, skyColour, 0.5 * normal.y + 0.5);
}

vec3 phongSpecular(vec3 normal, vec3 lightDir, vec3 viewDir) {
  float dotNL = saturate(dot(normal, lightDir));
  vec3 r = normalize(reflect(-lightDir, normal));
  float phongValue = pow(max(0.0, dot(viewDir, r)), 32.0);
  return dotNL * vec3(phongValue);
}

void main() {
  float grassY = vGrassData.y;
  float grassType = vGrassData.w;

  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);

  // uv: x = trái / phải, y = gốc / ngọn; lớp texture theo loại cỏ
  vec4 baseColour = texture2D(grassDiffuse, vec3(vGrassData.zy, grassType));
  if (baseColour.w < 0.5) discard;

  vec3 ambientLighting = hemiLight(normal, HEMI_GROUND, HEMI_SKY);
  vec3 specular = phongSpecular(normal, LIGHT_DIR, viewDir);

  // fake AO: gốc lá tối hơn
  float ao = remap(pow(grassY, 2.0), 0.0, 1.0, 0.125, 1.0);

  vec3 colour = baseColour.xyz * ambientLighting + specular * 0.25;
  colour *= ao;

  gl_FragColor = vec4(pow(colour, vec3(1.0 / 2.2)), 1.0);
}
