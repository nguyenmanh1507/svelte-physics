import * as THREE from 'three'

import { GLSL_NOISE } from './glsl-noise'

/** Toon ramp + caustics injection shared by every solid object. */
export function createToonKit() {
	const ramp = new THREE.DataTexture(new Uint8Array([90, 165, 255]), 3, 1, THREE.RedFormat)
	ramp.minFilter = ramp.magFilter = THREE.NearestFilter
	ramp.needsUpdate = true
	const shared = { uTime: { value: 0 }, uCaustOn: { value: 1 } }

	function toon(
		color: THREE.ColorRepresentation,
		opts: THREE.MeshToonMaterialParameters & { sway?: boolean } = {}
	) {
		const { sway, ...rest } = opts
		const m = new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...rest })
		m.onBeforeCompile = (sh) => {
			sh.uniforms.uTime = shared.uTime
			sh.uniforms.uCaustOn = shared.uCaustOn
			sh.vertexShader = sh.vertexShader
				.replace(
					'#include <common>',
					'#include <common>\nvarying vec3 vWPos;\nuniform float uTime;'
				)
				.replace(
					'#include <begin_vertex>',
					`#include <begin_vertex>
	        ${
						sway
							? `{ vec4 ip = vec4(0.0, 0.0, 0.0, 1.0);
	          #ifdef USE_INSTANCING
	          ip = instanceMatrix * ip;
	          #endif
	          float k = max(position.y, 0.0) / 4.0;
	          transformed.x += sin(uTime * 1.3 + ip.x * 0.4 + ip.z * 0.3) * k * k * 1.1;
	          transformed.z += cos(uTime * 1.1 + ip.z * 0.5) * k * k * 0.6; }`
							: ''
					}`
				)
				.replace(
					'#include <project_vertex>',
					`#include <project_vertex>
	        { vec4 wp = vec4(transformed, 1.0);
	          #ifdef USE_INSTANCING
	          wp = instanceMatrix * wp;
	          #endif
	          vWPos = (modelMatrix * wp).xyz; }`
				)
			sh.fragmentShader = sh.fragmentShader
				.replace(
					'#include <common>',
					`#include <common>\nvarying vec3 vWPos;\nuniform float uTime;\nuniform float uCaustOn;\n${GLSL_NOISE}`
				)
				.replace(
					'#include <dithering_fragment>',
					`
	        { float dw = -vWPos.y;
	          if (dw > 0.0) {
	            float c = caustic(vWPos.xz * 0.17, uTime * 0.8) * 0.65 + caustic(vWPos.xz * 0.31 + 3.7, uTime * 1.1) * 0.45;
	            c = mix(c, step(0.5, c), uCaustOn);
	            float up = clamp(normal.y * 0.5 + 0.5, 0.0, 1.0);
	            gl_FragColor.rgb *= mix(vec3(1.0), vec3(0.78, 0.93, 1.0), smoothstep(0.0, 9.0, dw));
	            gl_FragColor.rgb += vec3(0.85, 1.0, 0.95) * c * 0.32 * exp(-dw * 0.07) * smoothstep(0.0, 0.6, dw) * (0.4 + 0.6 * up);
	          } }
	        #include <dithering_fragment>`
				)
		}
		return m
	}

	return { toon, uniforms: shared, dispose: () => ramp.dispose() }
}

export type ToonKit = ReturnType<typeof createToonKit>
