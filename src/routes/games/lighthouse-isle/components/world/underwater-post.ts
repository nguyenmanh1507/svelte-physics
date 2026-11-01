import * as THREE from 'three'
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js'

import { GLSL_NOISE } from './glsl-noise'
import { HALF } from './terrain'
import type { Water } from './water'

const UNDERWATER_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`

const UNDERWATER_FRAGMENT = /* glsl */ `
#include <packing>
uniform sampler2D tScene, tDepth;
uniform mat4 uInvProj, uCamWorld;
uniform vec3 uCamPos, uCamFwd, uSunDir, uShallow, uDeep;
uniform float uNear, uFar, uClarity, uToon, uTime, uSubmerge;
varying vec2 vUv;
${GLSL_NOISE}

vec3 viewRay(vec2 uv) {
  vec4 v = uInvProj * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
  return normalize(mat3(uCamWorld) * (v.xyz / v.w));
}

// tDepth không chứa mặt nước và thành hộp, nên phải tự chặn tia tại biên khối nước
float distToVolumeEdge(vec3 ro, vec3 rd) {
  float d = rd.y > 1e-4 ? -ro.y / rd.y : 1e5;
  vec2 s = sign(rd.xz);
  vec2 t = (s * ${HALF.toFixed(1)} - ro.xz) / (s * max(abs(rd.xz), 1e-4));
  return min(d, min(t.x, t.y));
}

float toonBands(float t, float n) {
  float q = t * n;
  return mix(t, (floor(q) + smoothstep(0.4, 0.6, fract(q))) / n, uToon);
}

void main() {
  vec2 wobble = vec2(
    sin(vUv.y * 22.0 + uTime * 1.4) + vnoise(vUv * 9.0 + uTime * 0.35) - 0.5,
    cos(vUv.x * 18.0 + uTime * 1.1)
  ) * 0.0035;
  vec2 uv = clamp(vUv + wobble * uSubmerge, 0.0, 1.0);

  vec3 rd = viewRay(uv);
  float z = -perspectiveDepthToViewZ(texture2D(tDepth, uv).r, uNear, uFar);
  float hit = z / max(dot(rd, uCamFwd), 1e-3);
  float dist = max(min(hit, distToVolumeEdge(uCamPos, rd)), 0.0);
  float camDepth = max(-uCamPos.y, 0.0);

  vec3 scene = texture2D(tScene, uv).rgb;
  // cộng thêm quãng nước nền để vật ở sát camera vẫn ám màu biển
  vec3 transmitted = scene * exp(-vec3(1.6, 0.55, 0.3) * uClarity * (dist + 16.0));

  float fog = toonBands(1.0 - exp(-uClarity * (dist + 3.0) * 0.38), 5.0);
  float depthT = clamp((camDepth - rd.y * 12.0) / 16.0, 0.0, 1.0);
  vec3 fogCol = mix(uShallow, uDeep, depthT) * (1.0 - 0.3 * smoothstep(4.0, 14.0, camDepth));
  vec3 col = mix(transmitted, fogCol, fog);

  // tia nắng tỏa từ hướng mặt trời đã khúc xạ qua mặt nước
  vec3 sun = normalize(vec3(uSunDir.x * 0.75, uSunDir.y, uSunDir.z * 0.75));
  vec3 across = rd - sun * dot(rd, sun);
  float streak = vnoise(across.xz * 13.0 + uTime * 0.12) * vnoise(across.xz * 29.0 - uTime * 0.17);
  float shafts = pow(max(dot(rd, sun), 0.0), 5.0) * streak * exp(-camDepth * 0.08);
  col += vec3(0.75, 0.95, 1.0) * shafts * min(dist / 22.0, 1.0) * 1.4;

  col *= mix(0.6, 1.0, smoothstep(0.95, 0.3, length(vUv - 0.5)));

  gl_FragColor = vec4(mix(texture2D(tScene, vUv).rgb, col, uSubmerge), 1.0);
  #include <colorspace_fragment>
}`

type UnderwaterPostOptions = {
	camera: THREE.PerspectiveCamera
	waterUniforms: Water['uniforms']
}

/** Filter toàn màn hình khi camera chìm; nhận ảnh đã render xong vào `target`. */
export function createUnderwaterPost({ camera, waterUniforms }: UnderwaterPostOptions) {
	const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 })

	const material = new THREE.ShaderMaterial({
		depthTest: false,
		depthWrite: false,
		vertexShader: UNDERWATER_VERTEX,
		fragmentShader: UNDERWATER_FRAGMENT,
		uniforms: {
			tScene: { value: target.texture },
			tDepth: waterUniforms.tDepth,
			uInvProj: { value: camera.projectionMatrixInverse },
			uCamWorld: { value: camera.matrixWorld },
			uCamPos: waterUniforms.uCamPos,
			uCamFwd: waterUniforms.uCamFwd,
			uSunDir: waterUniforms.uSunDir,
			uShallow: waterUniforms.uShallow,
			uDeep: waterUniforms.uDeep,
			uNear: waterUniforms.uNear,
			uFar: waterUniforms.uFar,
			uClarity: waterUniforms.uClarity,
			uToon: waterUniforms.uToon,
			uTime: waterUniforms.uTime,
			uSubmerge: { value: 0 },
		},
	})
	const quad = new FullScreenQuad(material)

	function render(renderer: THREE.WebGLRenderer, submerge: number) {
		material.uniforms.uSubmerge.value = submerge
		renderer.setRenderTarget(null)
		quad.render(renderer)
	}

	function setSize(width: number, height: number) {
		target.setSize(width, height)
	}

	function dispose() {
		quad.dispose()
		material.dispose()
		target.dispose()
	}

	return { target, render, setSize, dispose }
}
