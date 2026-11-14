import * as THREE from 'three'

import { GLSL_NOISE } from './noise'

// dùng chung cho vòm trời và phản xạ trên mặt hồ, để hai bên luôn khớp màu
export const GLSL_SKY = /* glsl */ `
uniform vec3 uHorizon, uZenith, uSunDir, uSunCol;
uniform float uSkyTime;
vec3 titanSky(vec3 d) {
  float up = clamp(d.y, 0.0, 1.0);
  vec3 col = mix(uHorizon, uZenith, pow(up, 0.55));
  // các dải mây metan mờ trôi chậm trong lớp sương
  vec2 q = d.xz / (up + 0.25);
  float bands = vnoise(q * 1.6 + vec2(uSkyTime * 0.006, 0.0)) * 0.6 + vnoise(q * 4.1 - uSkyTime * 0.004) * 0.4;
  col *= 1.0 - 0.22 * smoothstep(0.45, 0.8, bands) * smoothstep(0.02, 0.3, up);
  // Mặt Trời chỉ còn là một quầng sáng nhoè sau sương; tắt dần về chân trời để khớp màu sương mù
  float s = max(dot(d, uSunDir), 0.0);
  col += uSunCol * (0.3 * pow(s, 6.0) + 0.45 * pow(s, 70.0)) * smoothstep(0.0, 0.22, up);
  return col;
}
`

export function createSkyUniforms(sunDir: THREE.Vector3) {
	return {
		uHorizon: { value: new THREE.Color('#c98a42') },
		uZenith: { value: new THREE.Color('#70431b') },
		uSunDir: { value: sunDir },
		uSunCol: { value: new THREE.Color('#ffc27a') },
		uSkyTime: { value: 0 },
	}
}

export type SkyUniforms = ReturnType<typeof createSkyUniforms>

export function createSky(uniforms: SkyUniforms) {
	const material = new THREE.ShaderMaterial({
		uniforms,
		side: THREE.BackSide,
		depthWrite: false,
		vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
		fragmentShader: /* glsl */ `
      ${GLSL_NOISE}
      ${GLSL_SKY}
      varying vec3 vDir;
      void main() {
        gl_FragColor = vec4(titanSky(normalize(vDir)), 1.0);
        #include <colorspace_fragment>
      }`,
	})
	const mesh = new THREE.Mesh(new THREE.SphereGeometry(2000, 32, 16), material)
	mesh.frustumCulled = false
	mesh.renderOrder = -1
	return mesh
}
