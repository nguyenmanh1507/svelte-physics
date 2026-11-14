import * as THREE from 'three'

const DROPS = 2400
// hộp chứa mưa bám theo camera; giọt ra khỏi hộp thì quấn vòng lại phía đối diện
const BOX = [60, 36, 60] as const

/**
 * Mưa metan: trọng lực yếu + khí quyển đặc nên giọt to (~1 cm) và rơi chỉ ~1.6 m/s,
 * chậm như tuyết. Mỗi giọt là một đoạn thẳng ngắn, vị trí tính hoàn toàn trong vertex shader.
 */
export function createRain(timeUniform: { value: number }, rng: () => number) {
	const positions = new Float32Array(DROPS * 6)
	const ends = new Float32Array(DROPS * 2)
	for (let i = 0; i < DROPS; i++) {
		const x = rng() * BOX[0],
			y = rng() * BOX[1],
			z = rng() * BOX[2]
		// hai đầu đoạn thẳng chung một gốc để cùng quấn vòng; aEnd kéo đầu trên ra
		positions.set([x, y, z, x, y, z], i * 6)
		ends[i * 2 + 1] = 1
	}
	const geometry = new THREE.BufferGeometry()
	geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
	geometry.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1))

	const uniforms = {
		uTime: timeUniform,
		uCamPos: { value: new THREE.Vector3() },
		uColor: { value: new THREE.Color('#ffd9a8') },
	}
	const material = new THREE.ShaderMaterial({
		uniforms,
		transparent: true,
		depthWrite: false,
		vertexShader: /* glsl */ `
      uniform float uTime; uniform vec3 uCamPos;
      attribute float aEnd;
      varying float vFade;
      const vec3 BOX = vec3(${BOX[0]}.0, ${BOX[1]}.0, ${BOX[2]}.0);
      const vec3 FALL = vec3(0.35, -1.6, 0.12); // m/s, hơi tạt theo gió
      void main() {
        vec3 p = position + FALL * uTime * (0.8 + 0.4 * fract(position.x * 7.13));
        p = mod(p - uCamPos, BOX) - 0.5 * BOX + uCamPos;
        p -= FALL * 0.16 * aEnd;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        vFade = smoothstep(30.0, 12.0, -mv.z) * smoothstep(0.4, 1.5, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
		fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vFade;
      void main() {
        gl_FragColor = vec4(uColor, 0.4 * vFade);
        #include <colorspace_fragment>
      }`,
	})

	const lines = new THREE.LineSegments(geometry, material)
	lines.frustumCulled = false
	lines.renderOrder = 2

	return {
		lines,
		uniforms,
		setIntensity(rain: number) {
			geometry.setDrawRange(0, Math.round(DROPS * rain) * 2)
		},
	}
}
