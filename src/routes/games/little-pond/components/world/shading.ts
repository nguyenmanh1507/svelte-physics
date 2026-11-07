import * as THREE from 'three'

// Uniform + GLSL dùng chung cho mọi vật liệu trong ao: bầu trời, caustics,
// bóng của lá sen và cá in xuống đáy (tính khúc xạ ánh sáng qua mặt nước).

export const MAX_PADS = 12
export const MAX_FISH = 8
export const CAUSTIC_DEPTH = 0.35 // mặt phẳng nhận caustics (m dưới mặt nước)
export const CAUSTIC_RANGE = 4.2 // nửa cạnh vùng caustics (m)

// Layer của mọi thứ nhìn thấy xuyên qua mặt nước (vẽ vào refraction buffer)
export const UNDER_LAYER = 1
export const under = <T extends THREE.Object3D>(o: T) => {
	o.layers.enable(UNDER_LAYER)
	return o
}

export function createPondUniforms() {
	return {
		uLight: { value: new THREE.Vector3(0.45, 0.82, 0.32).normalize() },
		uTime: { value: 0 },
		uSun: { value: 1 },
		uCaustics: { value: null as THREE.Texture | null },
		uPads: { value: Array.from({ length: MAX_PADS }, () => new THREE.Vector4(99, 99, 0, 0)) },
		uFish: { value: Array.from({ length: MAX_FISH }, () => new THREE.Vector4(99, -1, 99, 0)) },
		uFishD: { value: Array.from({ length: MAX_FISH }, () => new THREE.Vector2(1, 0)) },
	}
}

export type PondUniforms = ReturnType<typeof createPondUniforms>

const f = (n: number) => n.toFixed(3)

export const COMMON = /* glsl */ `
#define CD ${f(CAUSTIC_DEPTH)}
#define CR ${f(CAUSTIC_RANGE)}
uniform vec3 uLight; uniform float uTime; uniform float uSun; uniform sampler2D uCaustics;
uniform vec4 uPads[${MAX_PADS}]; uniform vec4 uFish[${MAX_FISH}]; uniform vec2 uFishD[${MAX_FISH}];
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y); }
vec3 skyColor(vec3 d){
  d = normalize(d); float y = max(d.y, 0.0);
  vec3 c = mix(vec3(0.86, 0.90, 0.88), vec3(0.36, 0.58, 0.84), pow(y, 0.5));
  float s = max(dot(d, uLight), 0.0);
  c += vec3(1.0, 0.93, 0.78) * (pow(s, 700.0) * 14.0 + pow(s, 8.0) * 0.25);
  if (d.y < 0.0) c = mix(c, vec3(0.34, 0.44, 0.26), min(-d.y * 6.0, 1.0));
  return c;
}
vec3 refrL(){ return refract(-uLight, vec3(0.0, 1.0, 0.0), 1.0 / 1.333); }
float caustic(vec3 p){
  vec3 rl = refrL(); vec3 q = p + rl * ((-CD - p.y) / rl.y);
  vec2 uv = q.xz / CR * 0.5 + 0.5;
  float c = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? 1.0 : min(texture2D(uCaustics, uv).r, 6.0);
  return mix(1.0, c, uSun * smoothstep(0.0, 0.06, -p.y));
}
// bóng của lá sen (trên mặt nước) và cá koi in lên những thứ bên dưới
float shadeBelow(vec3 p){
  vec3 L = -refrL(); float s = 1.0;
  vec2 q = p.xz + L.xz * (-p.y / L.y);
  for (int i = 0; i < ${MAX_PADS}; i++) { vec4 P = uPads[i]; if (P.w < 0.5) continue;
    s *= mix(0.42, 1.0, smoothstep(P.z * 0.85, P.z * 1.15, length(q - P.xy))); }
  for (int i = 0; i < ${MAX_FISH}; i++) { vec4 F = uFish[i]; float t = (F.y - p.y) / L.y; if (t <= 0.02) continue;
    vec2 d = p.xz + L.xz * t - F.xz; vec2 dir = uFishD[i];
    vec2 lc = vec2(dot(d, dir), dot(d, vec2(-dir.y, dir.x))) / vec2(F.w * 0.5, F.w * 0.14);
    s *= mix(0.6, 1.0, smoothstep(0.6, 1.3, length(lc))); }
  return s;
}
vec3 lit(vec3 base, vec3 n, vec3 p){
  bool under = p.y < 0.0;
  vec3 L = under ? -refrL() : uLight;
  float diff = max(dot(n, L), 0.0);
  float amb = 0.36 + 0.14 * n.y;
  float c = under ? caustic(p) * shadeBelow(p) : 1.0;
  return base * (amb + diff * c * 0.85);
}
`

export const WORLD_VERT = /* glsl */ `
varying vec3 vPos; varying vec3 vN;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vPos = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }
`

// Vật liệu "đặc" dùng chung vertex shader; body là phần fragment sau COMMON (đã có vPos, vN)
export function worldMaterial(
	uniforms: PondUniforms,
	body: string,
	params: THREE.ShaderMaterialParameters = {}
) {
	return new THREE.ShaderMaterial({
		uniforms,
		vertexShader: WORLD_VERT,
		fragmentShader: COMMON + 'varying vec3 vPos; varying vec3 vN;\n' + body,
		...params,
	})
}

// Màu phẳng có chiếu sáng của ao
export function litColorMaterial(
	uniforms: PondUniforms,
	[r, g, b]: [number, number, number],
	params: THREE.ShaderMaterialParameters = {}
) {
	return worldMaterial(
		uniforms,
		`void main(){ gl_FragColor = vec4(lit(vec3(${f(r)}, ${f(g)}, ${f(b)}), normalize(vN), vPos), 1.0); }`,
		params
	)
}

// Như WORLD_VERT nhưng cho InstancedMesh
export const INSTANCED_WORLD_VERT = /* glsl */ `
varying vec3 vPos; varying vec3 vN;
void main(){ vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vPos = w.xyz; vN = normal; gl_Position = projectionMatrix * viewMatrix * w; }
`
