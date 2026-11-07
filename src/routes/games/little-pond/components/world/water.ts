import * as THREE from 'three'
import { CAUSTIC_DEPTH, CAUSTIC_RANGE, COMMON, type PondUniforms } from './shading'
import { SIM_DX, SIM_N, SIM_SIZE, SIM_X0, type WaveSim } from './wave-sim'

// Mặt nước: mỗi đỉnh nằm đúng tâm một ô mô phỏng. Shader đọc refraction buffer (màu + depth của
// mọi thứ dưới nước) để khúc xạ, hấp thụ màu theo độ dày lớp nước, phản chiếu trời theo Fresnel.

const WATER_FRAGMENT =
	COMMON +
	/* glsl */ `
uniform sampler2D uRefr; uniform sampler2D uDepth; uniform vec2 uRes; uniform float uNear; uniform float uFar; uniform float uClear; uniform float uWind;
varying vec3 vPos; varying vec3 vN;
float lin(float z){ float n = z * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - n * (uFar - uNear)); }
// gợn gió lăn tăn: gradient của 2 lớp noise trôi
vec2 windGrad(vec2 p){
  float e = 0.02;
  vec2 a = p * 7.0 + vec2(uTime * 0.35, uTime * 0.21), b = p * 13.0 - vec2(uTime * 0.27, -uTime * 0.31);
  float h0 = vnoise(a) + 0.5 * vnoise(b);
  float hx = vnoise(a + vec2(e * 7.0, 0.0)) + 0.5 * vnoise(b + vec2(e * 13.0, 0.0));
  float hz = vnoise(a + vec2(0.0, e * 7.0)) + 0.5 * vnoise(b + vec2(0.0, e * 13.0));
  return vec2(hx - h0, hz - h0) / e * 0.0025;
}
void main(){
  vec2 wg = windGrad(vPos.xz) * uWind;
  vec3 n = normalize(normalize(vN) + vec3(-wg.x, 0.0, -wg.y));
  vec3 V = normalize(cameraPosition - vPos);
  float cosv = max(dot(n, V), 0.0);
  float F = 0.02 + 0.98 * pow(1.0 - cosv, 5.0);
  vec2 suv = gl_FragCoord.xy / uRes;
  float surf = lin(gl_FragCoord.z);
  float thick0 = max(lin(texture2D(uDepth, suv).r) - surf, 0.0);
  vec2 off = n.xz * 0.05 * min(thick0, 0.6) * 2.0;
  vec2 ruv = suv + off;
  float sd = lin(texture2D(uDepth, ruv).r);
  if (sd < surf) { ruv = suv; sd = lin(texture2D(uDepth, suv).r); }
  float thick = max(sd - surf, 0.0);
  vec3 refr = texture2D(uRefr, ruv).rgb;
  float k = mix(4.0, 0.35, uClear);
  vec3 T = exp(-thick * k * vec3(1.0, 0.42, 0.62));
  vec3 scatter = mix(vec3(0.10, 0.22, 0.12), vec3(0.16, 0.32, 0.26), uClear);
  refr = refr * T + scatter * (1.0 - T);
  vec3 refl = skyColor(reflect(-V, n));
  vec3 col = mix(refr, refl, F * 0.9);
  col += vec3(1.0, 0.94, 0.8) * pow(max(dot(reflect(-uLight, n), V), 0.0), 500.0) * 4.0;
  float edge = smoothstep(0.0, 0.025, thick0);
  col = mix(texture2D(uRefr, suv).rgb, col, edge);
  gl_FragColor = vec4(col, 1.0);
}`

const f = (n: number) => n.toFixed(3)

// Caustics: khúc xạ một lưới ánh sáng qua mặt nước, độ sáng = tỉ lệ diện tích trước/sau (dFdx/dFdy)
const CAUSTIC_VERTEX = /* glsl */ `
#define CD ${f(CAUSTIC_DEPTH)}
#define CR ${f(CAUSTIC_RANGE)}
uniform vec3 uLight; varying vec3 vOld; varying vec3 vNew;
void main(){
  vec3 rf = refract(-uLight, vec3(0.0, 1.0, 0.0), 1.0 / 1.333);
  vec3 rl = refract(-uLight, normalize(normal), 1.0 / 1.333);
  vOld = vec3(position.x, 0.0, position.z) + rf * (-CD / rf.y);
  vNew = position + rl * ((-CD - position.y) / rl.y);
  gl_Position = vec4(vNew.xz / CR, 0.0, 1.0);
}`
const CAUSTIC_FRAGMENT = /* glsl */ `varying vec3 vOld; varying vec3 vNew;
void main(){ float a = length(dFdx(vOld)) * length(dFdy(vOld)); float b = length(dFdx(vNew)) * length(dFdy(vNew)); gl_FragColor = vec4(a / max(b, 1e-9), 0.0, 0.0, 1.0); }`

function surfaceGeometry() {
	const g = new THREE.PlaneGeometry(SIM_SIZE, SIM_SIZE, SIM_N - 1, SIM_N - 1)
	g.rotateX(-Math.PI / 2)
	// co lại để đỉnh nằm trên tâm ô thay vì trên cạnh ô
	const p = g.attributes.position,
		s = (SIM_SIZE - SIM_DX) / SIM_SIZE
	for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * s, 0, p.getZ(i) * s)
	;(p as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage)
	;(g.attributes.normal as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage)
	return g
}

export function createWater(uniforms: PondUniforms, sim: WaveSim, camera: THREE.PerspectiveCamera) {
	const refraction = new THREE.WebGLRenderTarget(4, 4, {
		depthBuffer: true,
		depthTexture: new THREE.DepthTexture(4, 4),
	})
	const caustics = new THREE.WebGLRenderTarget(512, 512, {
		type: THREE.HalfFloatType,
		depthBuffer: false,
	})
	uniforms.uCaustics.value = caustics.texture

	const geometry = surfaceGeometry()
	const positions = geometry.attributes.position as THREE.BufferAttribute
	const normals = geometry.attributes.normal as THREE.BufferAttribute
	// mỗi đỉnh -> ô mô phỏng
	const cellOf = new Int32Array(positions.count)
	for (let v = 0; v < positions.count; v++) {
		const i = Math.round((positions.getX(v) - SIM_X0) / SIM_DX - 0.5),
			k = Math.round((positions.getZ(v) - SIM_X0) / SIM_DX - 0.5)
		cellOf[v] = k * SIM_N + i
	}

	const material = new THREE.ShaderMaterial({
		uniforms: {
			...uniforms,
			uRefr: { value: refraction.texture },
			uDepth: { value: refraction.depthTexture },
			uRes: { value: new THREE.Vector2(1, 1) },
			uNear: { value: camera.near },
			uFar: { value: camera.far },
			uClear: { value: 0.8 },
			uWind: { value: 1 },
		},
		vertexShader: /* glsl */ `varying vec3 vPos; varying vec3 vN; void main(){ vPos = position; vN = normal; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`,
		fragmentShader: WATER_FRAGMENT,
	})
	const mesh = new THREE.Mesh(geometry, material)
	mesh.frustumCulled = false
	mesh.renderOrder = 5

	const causticScene = new THREE.Scene()
	const causticMesh = new THREE.Mesh(
		geometry,
		new THREE.ShaderMaterial({
			uniforms,
			vertexShader: CAUSTIC_VERTEX,
			fragmentShader: CAUSTIC_FRAGMENT,
			blending: THREE.AdditiveBlending,
			transparent: true,
			depthTest: false,
			depthWrite: false,
			side: THREE.DoubleSide,
		})
	)
	causticMesh.frustumCulled = false
	causticScene.add(causticMesh)
	const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

	return {
		mesh,
		refraction,
		uniforms: material.uniforms,

		// chép độ cao + pháp tuyến từ lưới mô phỏng vào mesh
		updateGeometry() {
			const H = sim.height,
				pa = positions.array,
				na = normals.array
			for (let v = 0; v < cellOf.length; v++) {
				const id = cellOf[v],
					i = id % SIM_N,
					k = (id / SIM_N) | 0
				const hc = H[id]
				const l = i > 0 ? H[id - 1] : hc,
					r = i < SIM_N - 1 ? H[id + 1] : hc,
					d = k > 0 ? H[id - SIM_N] : hc,
					u = k < SIM_N - 1 ? H[id + SIM_N] : hc
				const gx = (r - l) / (2 * SIM_DX),
					gz = (u - d) / (2 * SIM_DX),
					inv = 1 / Math.hypot(gx, 1, gz)
				pa[v * 3 + 1] = hc
				na[v * 3] = -gx * inv
				na[v * 3 + 1] = inv
				na[v * 3 + 2] = -gz * inv
			}
			positions.needsUpdate = true
			normals.needsUpdate = true
		},

		renderCaustics(renderer: THREE.WebGLRenderer) {
			renderer.setRenderTarget(caustics)
			renderer.setClearColor(0x000000, 1)
			renderer.clear()
			renderer.render(causticScene, quadCamera)
		},

		setSize(width: number, height: number) {
			refraction.setSize(width, height)
			material.uniforms.uRes.value.set(width, height)
		},

		dispose() {
			refraction.dispose()
			caustics.dispose()
			causticMesh.material.dispose()
		},
	}
}
