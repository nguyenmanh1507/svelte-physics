import * as THREE from 'three'
import { COMMON, under, type PondUniforms } from './shading'
import { bottom, vnoise } from './terrain'

// Rong dưới đáy và lau sậy trên bờ: lá dẹt instanced, lắc theo gió trong vertex shader.

type Rgb = [number, number, number]
type Pick = (x: number, z: number) => { w: number; h: number } | null

interface BladeKind {
	count: number
	pick: Pick
	base: Rgb
	tip: Rgb
	sway: number
}

function bladeMaterial(uniforms: PondUniforms, { base, tip, sway }: BladeKind) {
	return new THREE.ShaderMaterial({
		uniforms: {
			...uniforms,
			uC0: { value: new THREE.Vector3(...base) },
			uC1: { value: new THREE.Vector3(...tip) },
			uSway: { value: sway },
		},
		side: THREE.DoubleSide,
		vertexShader: /* glsl */ `
uniform float uTime; uniform float uSway;
varying vec3 vPos; varying float vT; varying vec3 vN;
void main(){
  vec3 p = position; float t = uv.y; p.x *= (1.0 - t * 0.85);
  vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
  float ph = instanceMatrix[3].x * 3.1 + instanceMatrix[3].z * 2.3;
  wp.xz += vec2(sin(uTime * 1.2 + ph), cos(uTime * 0.9 + ph * 1.3)) * uSway * t * t;
  vPos = wp.xyz; vT = t; vN = normalize(mat3(modelMatrix * instanceMatrix) * vec3(0.0, 0.0, 1.0));
  gl_Position = projectionMatrix * viewMatrix * wp;
}`,
		fragmentShader:
			COMMON +
			/* glsl */ `
uniform vec3 uC0; uniform vec3 uC1; varying vec3 vPos; varying float vT; varying vec3 vN;
void main(){
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  n = normalize(n + vec3(0.0, 0.6, 0.0));
  gl_FragColor = vec4(lit(mix(uC0, uC1, vT), n, vPos), 1.0);
}`,
	})
}

function scatter(geometry: THREE.BufferGeometry, material: THREE.Material, kind: BladeKind) {
	const mesh = new THREE.InstancedMesh(geometry, material, kind.count)
	const m4 = new THREE.Matrix4(),
		q = new THREE.Quaternion(),
		e = new THREE.Euler(),
		pos = new THREE.Vector3(),
		scale = new THREE.Vector3()
	let n = 0,
		tries = 0
	while (n < kind.count && tries < kind.count * 40) {
		tries++
		const x = (Math.random() - 0.5) * 8,
			z = (Math.random() - 0.5) * 8
		const r = kind.pick(x, z)
		if (!r) continue
		e.set((Math.random() - 0.5) * 0.4, Math.random() * Math.PI, (Math.random() - 0.5) * 0.4)
		q.setFromEuler(e)
		m4.compose(pos.set(x, bottom(x, z) - 0.005, z), q, scale.set(r.w, r.h, 1))
		mesh.setMatrixAt(n++, m4)
	}
	mesh.count = n
	mesh.instanceMatrix.needsUpdate = true
	mesh.frustumCulled = false
	return under(mesh)
}

const KINDS: BladeKind[] = [
	{
		// rong dưới đáy, mọc thành từng đám theo noise
		count: 3200,
		pick: (x, z) => {
			const b = bottom(x, z)
			if (b > -0.1 || vnoise(x * 1.3 + 4, z * 1.3) < 0.48) return null
			return {
				w: 0.012 + Math.random() * 0.012,
				h: Math.min(0.08 + Math.random() * 0.28, -b - 0.07),
			}
		},
		base: [0.08, 0.22, 0.1],
		tip: [0.3, 0.55, 0.22],
		sway: 0.05,
	},
	{
		// lau sậy ở hai khúc bờ
		count: 520,
		pick: (x, z) => {
			const b = bottom(x, z)
			if (b < -0.06 || b > 0.06) return null
			const th = Math.atan2(z, x)
			if (!(Math.abs(th - 2.4) < 0.45 || Math.abs(th + 0.9) < 0.3)) return null
			return { w: 0.02 + Math.random() * 0.012, h: 0.5 + Math.random() * 0.55 }
		},
		base: [0.22, 0.34, 0.12],
		tip: [0.62, 0.66, 0.34],
		sway: 0.06,
	},
]

export function createBlades(uniforms: PondUniforms) {
	const group = new THREE.Group()
	const geometry = new THREE.PlaneGeometry(1, 1, 1, 5)
	geometry.translate(0, 0.5, 0)
	for (const kind of KINDS) group.add(scatter(geometry, bladeMaterial(uniforms, kind), kind))
	return group
}
