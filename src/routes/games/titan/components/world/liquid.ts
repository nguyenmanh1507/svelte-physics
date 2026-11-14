import * as THREE from 'three'

import { createWarpedGrid } from './grid'
import { GLSL_SKY, type SkyUniforms } from './sky'
import { GLSL_NOISE, smooth } from './noise'
import { LIQUID_HALF, LIQUID_LEVEL, shoreDistance } from './terrain'
import { GLSL_WAVES, type Waves } from './waves'

// chiết suất metan/etan lỏng ≈ 1.27 (nước là 1.33) -> F0 = ((n-1)/(n+1))² ≈ 0.014
const F0 = 0.014

const VERTEX = /* glsl */ `
${GLSL_NOISE}
${GLSL_WAVES}
attribute float aCalm;
varying vec3 vWPos;
varying float vCalm;
void main() {
  vec3 p = position;
  vec2 slope; float rough;
  p.y += waveH(p.xz, aCalm, slope, rough);
  vCalm = aCalm;
  vWPos = (modelMatrix * vec4(p, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWPos, 1.0);
}`

const FRAGMENT = /* glsl */ `
#include <packing>
${GLSL_NOISE}
${GLSL_WAVES}
${GLSL_SKY}
uniform sampler2D tColor, tDepth;
uniform vec2 uRes;
uniform float uNear, uFar, uRain, uFogDensity;
uniform vec3 uCamPos, uCamFwd, uSigma, uScatter;
varying vec3 vWPos;
varying float vCalm;

// khoảng cách dọc tia nhìn tới vật đặc phía sau mặt chất lỏng (handbook 8.2)
float sceneDist(vec2 uv, vec3 rd) {
  float z = -perspectiveDepthToViewZ(texture2D(tDepth, uv).r, uNear, uFar);
  return z / max(dot(rd, uCamFwd), 1e-3);
}

// vòng gợn do hạt mưa metan: mỗi ô lưới thỉnh thoảng có một giọt rơi, vòng sóng loang ra rồi tắt
vec2 rainRings(vec2 p, float cell, float seed) {
  vec2 q = p / cell + seed, i = floor(q), f = fract(q), s = vec2(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y)), id = i + g;
    float clock = uTime * 0.3 + hash12(id + 7.7);
    float age = fract(clock);
    // mỗi chu kỳ bốc thăm lại xem ô này có giọt rơi không
    float on = step(1.0 - uRain, hash12(id + floor(clock) * 13.1));
    vec2 r = g + 0.2 + 0.6 * hash22(id) - f;
    float d = length(r), w = (d - age * 0.9) / 0.07;
    s += on * sin(w * 3.0) * exp(-w * w) * (1.0 - age) * (1.0 - age) * r / max(d, 1e-3);
  }
  return s;
}

void main() {
  vec2 suv = gl_FragCoord.xy / uRes;
  vec3 toP = vWPos - uCamPos;
  float wd = length(toP);
  vec3 rd = toP / wd;

  // pháp tuyến tính theo từng pixel từ đúng hàm sóng của vertex shader
  vec2 slope; float rough;
  waveH(vWPos.xz, vCalm, slope, rough);
  // gợn lăn tăn và vòng mưa nhỏ hơn 1 pixel ở xa nên cho tắt dần để khỏi nhấp nháy
  float near = exp(-wd / 70.0);
  vec2 micro = vec2(vnoise(vWPos.xz * 2.7 + uTime * 0.25), vnoise(vWPos.xz * 2.9 - uTime * 0.21 + 31.0)) - 0.5;
  slope += micro * 0.07 * uAmp * rough * near;
  slope += (rainRings(vWPos.xz, 1.3, 0.0) + rainRings(vWPos.xz, 2.3, 17.3)) * 0.15 * near;
  vec3 n = normalize(vec3(-slope.x, 1.0, -slope.y));

  float sd = sceneDist(suv, rd);
  float thick = max(sd - wd, 0.0);
  float vdepth = thick * max(-rd.y, 0.08);

  // khúc xạ trong không gian màn hình; nếu lấy mẫu trúng vật đứng trước mặt hồ thì bỏ độ lệch (handbook 8.4)
  vec2 ruv = suv + n.xz * 0.03 * clamp(thick * 0.12, 0.0, 1.0);
  float sd2 = sceneDist(ruv, rd);
  if (sd2 < wd) { ruv = suv; sd2 = sd; }
  float th2 = max(sd2 - wd, 0.0);
  vec3 bg = texture2D(tColor, ruv).rgb;

  // Beer-Lambert (handbook 8.3); trộn với độ sâu thẳng đứng để góc nhìn sát mặt hồ không bị bệt một màu
  float path = mix(th2, th2 * max(-rd.y, 0.08) * 1.8, 0.55);
  vec3 col = bg * exp(-uSigma * path) + uScatter * (1.0 - exp(-0.5 * path));

  // Fresnel Schlick với F0 của metan lỏng; tia phản xạ không được chui xuống dưới chân trời
  float fres = ${F0} + ${1 - F0} * pow(1.0 - max(dot(-rd, n), 0.0), 5.0);
  vec3 R = reflect(rd, n);
  R.y = abs(R.y);
  // ở xa, gợn sóng nhỏ hơn 1 pixel: mảng đang bị gió thổi phản xạ trung bình một vùng trời cao hơn (tối hơn)
  // và làm nhoè vệt nắng, còn mảng lặng vẫn như gương. Nhờ vậy toàn cảnh có vệt sáng tối thay vì đều một màu
  float haze = clamp(rough * min(uAmp, 2.0) * 0.5, 0.0, 1.0) * (1.0 - near);
  vec3 Rr = normalize(R + vec3(0.0, 0.5 * haze, 0.0));
  col = mix(col, titanSky(Rr), fres * (1.0 - 0.25 * haze));
  // quầng Mặt Trời nhoè trong sương -> vệt sáng rộng và yếu, không có đốm chói
  col += uSunCol * pow(max(dot(R, uSunDir), 0.0), mix(90.0, 25.0, haze)) * mix(0.5, 0.22, haze);

  // mép hồ: lớp chất lỏng mỏng dần thành trong suốt, không có bọt trắng
  col = mix(texture2D(tColor, suv).rgb, col, smoothstep(0.0, 0.05, vdepth));

  float fog = 1.0 - exp(-pow(wd * uFogDensity, 2.0));
  gl_FragColor = vec4(mix(col, uHorizon, fog), 1.0);
  #include <colorspace_fragment>
}`

type LiquidOptions = {
	camera: THREE.PerspectiveCamera
	waves: Waves
	sky: SkyUniforms
	timeUniform: { value: number }
}

export function createLiquid({ camera, waves, sky, timeUniform }: LiquidOptions) {
	// pass 1 vẽ phần đặc vào đây; shader chất lỏng đọc lại màu + depth ở pass 2 (handbook 8.1)
	const depthTexture = new THREE.DepthTexture(1, 1, THREE.FloatType)
	depthTexture.format = THREE.DepthFormat
	const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthTexture })

	const uniforms = {
		...sky,
		uTime: timeUniform,
		uAmp: { value: waves.state.amp },
		uWaves: { value: waves.uWaves },
		uRain: { value: 0 },
		uFogDensity: { value: 0 },
		tColor: { value: rt.texture },
		tDepth: { value: depthTexture },
		uRes: { value: new THREE.Vector2(1, 1) },
		uNear: { value: camera.near },
		uFar: { value: camera.far },
		uCamPos: { value: new THREE.Vector3() },
		uCamFwd: { value: new THREE.Vector3() },
		// hệ số hấp thụ (1/m): metan tinh khiết gần như trong suốt; ở đây giả định có chất hữu cơ
		// hoà tan nuốt ánh xanh trước, nên chỗ nông ngả hổ phách và chỗ sâu tối sẫm
		uSigma: { value: new THREE.Vector3(0.11, 0.17, 0.32) },
		uScatter: { value: new THREE.Color('#1f1208') },
	}

	// sóng lặng dần khi vào sát bờ (nước nông, khuất gió); mực hồ đứng yên nên tính sẵn theo đỉnh
	const SEGMENTS = 256
	const calm = new Float32Array((SEGMENTS + 1) ** 2)
	const geometry = createWarpedGrid(LIQUID_HALF, SEGMENTS, (x, z, index) => {
		calm[index] = 0.12 + 0.88 * smooth(0, 32, -shoreDistance(x, z))
		return LIQUID_LEVEL
	})
	geometry.setAttribute('aCalm', new THREE.BufferAttribute(calm, 1))
	const mesh = new THREE.Mesh(
		geometry,
		new THREE.ShaderMaterial({ uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT })
	)
	mesh.frustumCulled = false
	mesh.renderOrder = 1

	function setSize(width: number, height: number) {
		rt.setSize(width, height)
		uniforms.uRes.value.set(width, height)
	}

	function update() {
		uniforms.uAmp.value = waves.state.amp
		uniforms.uCamPos.value.copy(camera.position)
		camera.getWorldDirection(uniforms.uCamFwd.value)
	}

	function dispose() {
		depthTexture.dispose()
		rt.dispose()
	}

	return { mesh, rt, uniforms, setSize, update, dispose }
}
