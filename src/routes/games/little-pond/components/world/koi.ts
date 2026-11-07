import * as THREE from 'three'
import { createKoiState, steerKoi, type KoiState, type SteerWorld } from './koi-steering'
import { COMMON, MAX_FISH, under, type PondUniforms } from './shading'

// Cá koi: thân là cầu kéo dài, vây là tam giác; quẫy đuôi trong vertex shader,
// hoa văn từng giống vẽ bằng noise trong fragment shader.

type Rgb = [number, number, number]

interface KoiVariety {
	name: string
	c1: Rgb // màu nền
	c2: Rgb // mảng lớn
	c3: Rgb // đốm
	patch: number
	spot: number
	length: number
}

export const KOI_VARIETIES: KoiVariety[] = [
	{
		name: 'kohaku',
		c1: [0.97, 0.95, 0.9],
		c2: [0.92, 0.25, 0.1],
		c3: [0.97, 0.95, 0.9],
		patch: 0.06,
		spot: 0.0,
		length: 0.56,
	},
	{
		name: 'kohaku',
		c1: [0.97, 0.95, 0.9],
		c2: [0.95, 0.32, 0.08],
		c3: [0.97, 0.95, 0.9],
		patch: -0.02,
		spot: 0.0,
		length: 0.46,
	},
	{
		name: 'showa',
		c1: [0.08, 0.08, 0.09],
		c2: [0.93, 0.33, 0.1],
		c3: [0.96, 0.94, 0.9],
		patch: 0.04,
		spot: 0.7,
		length: 0.53,
	},
	{
		name: 'yamabuki',
		c1: [0.98, 0.78, 0.22],
		c2: [0.99, 0.84, 0.35],
		c3: [0.98, 0.78, 0.22],
		patch: 0.0,
		spot: 0.0,
		length: 0.5,
	},
	{
		name: 'chagoi',
		c1: [0.55, 0.38, 0.22],
		c2: [0.62, 0.45, 0.27],
		c3: [0.4, 0.27, 0.15],
		patch: 0.0,
		spot: 0.4,
		length: 0.62,
	},
	{
		name: 'ogon',
		c1: [0.86, 0.87, 0.85],
		c2: [0.95, 0.95, 0.93],
		c3: [0.86, 0.87, 0.85],
		patch: 0.0,
		spot: 0.0,
		length: 0.45,
	},
	{
		name: 'sanke',
		c1: [0.97, 0.95, 0.9],
		c2: [0.92, 0.22, 0.1],
		c3: [0.07, 0.07, 0.08],
		patch: 0.0,
		spot: 0.5,
		length: 0.49,
	},
]

function koiGeometry(L: number) {
	const half = L / 2,
		W = L * 0.12,
		Hh = L * 0.14
	const body = new THREE.SphereGeometry(1, 28, 16)
	const p = body.attributes.position
	for (let i = 0; i < p.count; i++) {
		const x = p.getX(i),
			y = p.getY(i),
			z = p.getZ(i)
		// x: -1 đuôi .. +1 đầu
		const taper = x > 0 ? 1.0 - 0.15 * x * x : 1.0 + x * 0.72
		p.setXYZ(i, x * half, y * Hh * 0.5 * taper * (y < 0 ? 0.85 : 1), z * W * 0.5 * taper)
	}
	body.computeVertexNormals()

	const pos = [...body.attributes.position.array],
		nrm = [...body.attributes.normal.array],
		fins = new Array<number>(p.count).fill(0)
	const idx = [...body.index!.array]
	body.dispose()
	// kind 1 = vây đuôi/lưng, 2 = vây ngực (vỗ lên xuống)
	const addTri = (a: number[], b: number[], c: number[], kind: number) => {
		const base = pos.length / 3
		for (const v of [a, b, c]) {
			pos.push(...v)
			nrm.push(0, 1, 0)
			fins.push(kind)
		}
		idx.push(base, base + 1, base + 2)
	}
	const tx = -half * 0.92
	// vây đuôi hai thuỳ
	addTri([tx, 0, 0], [tx - L * 0.3, Hh * 0.75, 0], [tx - L * 0.2, 0, 0], 1)
	addTri([tx, 0, 0], [tx - L * 0.2, 0, 0], [tx - L * 0.3, -Hh * 0.7, 0], 1)
	addTri([tx + L * 0.02, Hh * 0.15, 0], [tx - L * 0.3, Hh * 0.75, 0], [tx, -Hh * 0.15, 0], 1)
	addTri([tx + L * 0.02, -Hh * 0.15, 0], [tx, Hh * 0.15, 0], [tx - L * 0.3, -Hh * 0.7, 0], 1)
	// vây lưng
	addTri([half * 0.35, Hh * 0.45, 0], [-half * 0.35, Hh * 0.95, 0], [-half * 0.55, Hh * 0.35, 0], 1)
	// vây ngực
	for (const s of [1, -1]) {
		addTri(
			[half * 0.45, -Hh * 0.25, s * W * 0.4],
			[half * 0.05, -Hh * 0.35, s * W * 2.1],
			[half * 0.22, -Hh * 0.3, s * W * 0.4],
			2
		)
	}
	const g = new THREE.BufferGeometry()
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
	g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3))
	g.setAttribute('fin', new THREE.Float32BufferAttribute(fins, 1))
	g.setIndex(idx)
	return g
}

function koiMaterial(uniforms: PondUniforms, k: KoiVariety, seed: number) {
	return new THREE.ShaderMaterial({
		uniforms: {
			...uniforms,
			uPhase: { value: 0 },
			uAmp: { value: 0.02 },
			uHalf: { value: k.length / 2 },
			uH: { value: k.length * 0.14 },
			uC1: { value: new THREE.Vector3(...k.c1) },
			uC2: { value: new THREE.Vector3(...k.c2) },
			uC3: { value: new THREE.Vector3(...k.c3) },
			uPatch: { value: k.patch },
			uSpot: { value: k.spot },
			uSeed: { value: seed },
		},
		side: THREE.DoubleSide,
		vertexShader: /* glsl */ `
attribute float fin;
uniform float uPhase; uniform float uAmp; uniform float uHalf;
varying vec3 vPos; varying vec3 vN; varying vec3 vL; varying float vFin;
void main(){
  vec3 p = position; float xn = p.x / uHalf;
  float w = smoothstep(0.7, -1.6, xn);
  float bend = sin(xn * 2.4 + uPhase) * uAmp * (0.12 + w * 1.4);
  p.z += bend;
  if (fin > 1.5) p.y += sin(uPhase * 0.7) * 0.012 * abs(position.z) / 0.05;
  vL = position; vFin = fin;
  vec3 n = normal; n.x -= cos(xn * 2.4 + uPhase) * uAmp * 2.4 / uHalf * (0.12 + w * 1.4) * 0.3;
  vec4 wp = modelMatrix * vec4(p, 1.0); vPos = wp.xyz; vN = normalize(mat3(modelMatrix) * n);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`,
		fragmentShader:
			COMMON +
			/* glsl */ `
uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform float uPatch; uniform float uSpot; uniform float uSeed; uniform float uHalf; uniform float uH;
varying vec3 vPos; varying vec3 vN; varying vec3 vL; varying float vFin;
void main(){
  vec3 n = normalize(vN); vec3 V = normalize(cameraPosition - vPos); if (dot(n, V) < 0.0) n = -n;
  vec2 q = vec2(vL.x / uHalf, vL.z / uHalf);
  float n1 = vnoise(q * vec2(3.2, 5.0) + uSeed) * 0.7 + vnoise(q * 9.0 + uSeed * 2.0) * 0.3;
  float back = smoothstep(-0.3, 0.4, vL.y / uH);
  float patchM = smoothstep(0.5, 0.56, n1 + uPatch) * back;
  float n2 = vnoise(q * vec2(7.0, 9.0) + uSeed * 3.7);
  float spot = smoothstep(0.66, 0.70, n2) * uSpot * back;
  vec3 c = mix(uC1, uC2, patchM);
  c = mix(c, uC3, spot);
  c = mix(c, mix(c, vec3(0.95, 0.93, 0.88), 0.55), smoothstep(0.0, -0.6, vL.y / uH));
  if (vL.x / uHalf > 0.78 && abs(abs(vL.z) - uH * 0.28) < uH * 0.11 && vL.y > 0.0) c = vec3(0.03);
  if (vFin > 0.5) c = mix(uC1, vec3(1.0, 0.96, 0.92), 0.45);
  vec3 col = lit(c, n, vPos);
  col += vec3(1.0, 0.97, 0.9) * pow(max(dot(reflect(-uLight, n), V), 0.0), 30.0) * 0.18 * caustic(vPos);
  gl_FragColor = vec4(col, 1.0);
}`,
	})
}

interface Koi {
	state: KoiState
	mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>
}

export function createKoiPond(uniforms: PondUniforms) {
	const group = new THREE.Group()
	const koi: Koi[] = KOI_VARIETIES.slice(0, MAX_FISH).map((k, i) => {
		const mesh = under(
			new THREE.Mesh(koiGeometry(k.length), koiMaterial(uniforms, k, i * 7.31 + 1.7))
		)
		group.add(mesh)
		return { state: createKoiState(k.length), mesh }
	})
	const states = koi.map((k) => k.state)

	return {
		group,
		states,
		update(dt: number, world: Omit<SteerWorld, 'fishes'>) {
			const steerWorld = { ...world, fishes: states }
			koi.forEach(({ state, mesh }, i) => {
				steerKoi(state, steerWorld, dt)
				mesh.position.copy(state.pos)
				mesh.rotation.set(0, state.yaw, 0)
				mesh.material.uniforms.uPhase.value = state.phase
				mesh.material.uniforms.uAmp.value = state.swimAmp
				// vị trí + hướng cá cho bóng in xuống đáy
				uniforms.uFish.value[i].set(state.pos.x, state.pos.y, state.pos.z, state.length)
				uniforms.uFishD.value[i].set(Math.cos(-state.yaw), Math.sin(-state.yaw))
			})
		},
	}
}
