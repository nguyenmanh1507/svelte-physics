import * as THREE from 'three'
import {
	COMMON,
	litColorMaterial,
	MAX_PADS,
	under,
	worldMaterial,
	type PondUniforms,
} from './shading'
import { bottom, hash2 } from './terrain'
import type { WaveSim } from './wave-sim'

// Lá sen nổi theo mặt nước, cuống cắm xuống đáy, hoa nở và nụ.

// [x, z, bán kính]
const PAD_SPOTS: [number, number, number][] = [
	[-1.35, -0.85, 0.3],
	[-1.0, -1.35, 0.24],
	[-1.75, -0.35, 0.22],
	[-0.65, -0.95, 0.18],
	[-1.55, -1.25, 0.2],
	[1.3, 0.95, 0.28],
	[0.9, 1.35, 0.22],
	[1.7, 0.55, 0.19],
	[1.15, 0.45, 0.16],
	[0.55, 1.05, 0.15],
]

// [x, z, độ cao, là nụ]
const FLOWER_SPOTS: [number, number, number, boolean][] = [
	[-1.15, -1.05, 0.24, false],
	[-1.6, -0.75, 0.32, false],
	[1.05, 1.1, 0.27, false],
	[1.5, 0.75, 0.38, true],
	[-0.8, -1.25, 0.4, true],
]

export interface Pad {
	mesh: THREE.Mesh
	x: number
	z: number
	r: number
	rot: number
	ph: number
}

function padMaterial(uniforms: PondUniforms) {
	return new THREE.ShaderMaterial({
		uniforms,
		side: THREE.DoubleSide,
		vertexShader: /* glsl */ `varying vec3 vPos; varying vec3 vN; varying vec2 vL;
void main(){ vL = position.xz; vec4 w = modelMatrix * vec4(position,1.); vPos = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
		fragmentShader:
			COMMON +
			/* glsl */ `
varying vec3 vPos; varying vec3 vN; varying vec2 vL;
void main(){
  vec3 n = normalize(vN); if (n.y < 0.0) n = -n;
  float r = length(vL), a = atan(vL.y, vL.x);
  float vein = smoothstep(0.92, 1.0, abs(sin(a * 11.0))) * smoothstep(0.08, 0.3, r) * 0.25;
  vec3 c = mix(vec3(0.20, 0.42, 0.14), vec3(0.34, 0.56, 0.20), vnoise(vL * 9.0 + vPos.xz));
  c = mix(c, vec3(0.62, 0.72, 0.38), vein);
  c = mix(c, vec3(0.55, 0.40, 0.20), smoothstep(0.93, 1.0, r) * 0.6);
  c = mix(c, vec3(0.76, 0.82, 0.46), smoothstep(0.06, 0.0, r));
  vec3 col = lit(c, n, vPos);
  vec3 V = normalize(cameraPosition - vPos);
  col += vec3(1.0, 0.95, 0.85) * pow(max(dot(reflect(-uLight, n), V), 0.0), 40.0) * 0.25;
  gl_FragColor = vec4(col, 1.0);
}`,
	})
}

function petalMaterial(uniforms: PondUniforms) {
	return new THREE.ShaderMaterial({
		uniforms,
		side: THREE.DoubleSide,
		vertexShader: /* glsl */ `attribute float tip; varying float vTip; varying vec3 vPos; varying vec3 vN;
void main(){ vTip = tip; vec4 w = modelMatrix * vec4(position,1.); vPos = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
		fragmentShader:
			COMMON +
			/* glsl */ `
varying float vTip; varying vec3 vPos; varying vec3 vN;
void main(){
  vec3 n = normalize(vN); vec3 V = normalize(cameraPosition - vPos); if (dot(n, V) < 0.0) n = -n;
  vec3 c = mix(vec3(0.99, 0.93, 0.92), vec3(0.93, 0.40, 0.60), pow(vTip, 1.6));
  float d = max(dot(n, uLight), 0.0), back = max(dot(-n, uLight), 0.0) * 0.35;
  gl_FragColor = vec4(c * (0.5 + 0.55 * d + back), 1.0);
}`,
	})
}

function podMaterial(uniforms: PondUniforms) {
	return worldMaterial(
		uniforms,
		/* glsl */ `void main(){ vec3 n = normalize(vN);
  vec3 c = n.y > 0.7 ? mix(vec3(0.80, 0.78, 0.30), vec3(0.45, 0.50, 0.18), step(0.75, hash12(floor(vPos.xz * 140.0)))) : vec3(0.95, 0.80, 0.30);
  gl_FragColor = vec4(lit(c, n, vPos), 1.0); }`
	)
}

// Lá sen: đĩa khuyết một khe, mép hơi vểnh lên
function padGeometry() {
	const g = new THREE.CircleGeometry(1, 48, 0.2, Math.PI * 2 - 0.4)
	g.rotateX(-Math.PI / 2)
	const p = g.attributes.position
	for (let i = 0; i < p.count; i++) {
		const r = Math.hypot(p.getX(i), p.getZ(i))
		p.setY(i, 0.035 * r * r - 0.02 * r)
	}
	g.computeVertexNormals()
	return g
}

// Một vòng cánh hoa: `open` là góc ngả ra ngoài, `roll` xoay lệch giữa các vòng
function addPetalRing(
	out: { pos: number[]; tip: number[]; nrm: number[] },
	open: number,
	count: number,
	len: number,
	wid: number,
	roll: number,
	lift: number
) {
	const SU = 6,
		SV = 4
	for (let p = 0; p < count; p++) {
		const yaw = (p / count) * Math.PI * 2 + roll
		const mat = new THREE.Matrix4()
			.makeRotationY(yaw)
			.multiply(new THREE.Matrix4().makeRotationX(-open))
		const pt = (u: number, v: number) => {
			const w = wid * Math.pow(Math.sin(Math.PI * Math.min(u * 0.92 + 0.04, 1)), 0.7)
			return new THREE.Vector3(
				v * w,
				u * len + lift,
				v * v * wid * 0.55 + u * u * len * 0.18
			).applyMatrix4(mat)
		}
		for (let a = 0; a < SU; a++)
			for (let c = 0; c < SV; c++) {
				const u0 = a / SU,
					u1 = (a + 1) / SU,
					v0 = (c / SV) * 2 - 1,
					v1 = ((c + 1) / SV) * 2 - 1
				const quad: [number, number][] = [
					[u0, v0],
					[u1, v0],
					[u1, v1],
					[u0, v0],
					[u1, v1],
					[u0, v1],
				]
				const P = quad.map(([u, v]) => pt(u, v))
				const n = P[1].clone().sub(P[0]).cross(P[2].clone().sub(P[0])).normalize()
				quad.forEach(([u], j) => {
					out.pos.push(P[j].x, P[j].y, P[j].z)
					out.tip.push(u)
					out.nrm.push(n.x, n.y, n.z)
				})
			}
	}
}

function flowerGeometry(bud: boolean) {
	const out = { pos: [] as number[], tip: [] as number[], nrm: [] as number[] }
	if (bud) addPetalRing(out, 0.18, 6, 0.13, 0.05, 0, 0)
	else {
		addPetalRing(out, 1.15, 10, 0.12, 0.05, 0.0, 0)
		addPetalRing(out, 0.75, 9, 0.12, 0.048, 0.3, 0.005)
		addPetalRing(out, 0.4, 7, 0.1, 0.042, 0.1, 0.01)
	}
	const g = new THREE.BufferGeometry()
	g.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3))
	g.setAttribute('normal', new THREE.Float32BufferAttribute(out.nrm, 3))
	g.setAttribute('tip', new THREE.Float32BufferAttribute(out.tip, 1))
	return g
}

export function createLotus(uniforms: PondUniforms) {
	const group = new THREE.Group()
	const stemMat = litColorMaterial(uniforms, [0.3, 0.42, 0.18])
	const up = new THREE.Vector3(0, 1, 0)

	const stem = (a: THREE.Vector3, b: THREE.Vector3, radius: number) => {
		const m = new THREE.Mesh(
			new THREE.CylinderGeometry(radius, radius * 1.2, a.distanceTo(b), 6, 1, true),
			stemMat
		)
		m.position.copy(a).add(b).multiplyScalar(0.5)
		m.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize())
		return under(m)
	}

	const padGeo = padGeometry()
	const padMat = padMaterial(uniforms)
	const pads: Pad[] = PAD_SPOTS.slice(0, MAX_PADS).map(([x, z, r], i) => {
		const mesh = new THREE.Mesh(padGeo, padMat)
		mesh.scale.setScalar(r)
		mesh.rotation.y = hash2(i, 5) * 6.28
		group.add(mesh)
		group.add(
			stem(
				new THREE.Vector3(x + 0.05, bottom(x, z), z - 0.04),
				new THREE.Vector3(x, -0.01, z),
				0.007
			)
		)
		return { mesh, x, z, r, rot: mesh.rotation.y, ph: hash2(i, 8) * 6 }
	})

	const petals = petalMaterial(uniforms)
	const pods = podMaterial(uniforms)
	const flowers = FLOWER_SPOTS.map(([x, z, h, bud], i) => {
		const g = new THREE.Group()
		g.add(new THREE.Mesh(flowerGeometry(bud), petals))
		if (!bud) {
			const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.022, 0.03, 16), pods)
			pod.position.y = 0.03
			g.add(pod)
		}
		g.position.set(x, h, z)
		g.scale.setScalar(1.5)
		group.add(g)
		group.add(
			stem(new THREE.Vector3(x - 0.04, bottom(x, z), z + 0.03), new THREE.Vector3(x, h, z), 0.006)
		)
		return { g, ph: i * 1.7 }
	})

	return {
		group,
		pads,
		// lá trôi nhẹ và nghiêng theo mặt nước; ghi vị trí lá vào uniform để đổ bóng xuống đáy
		update(time: number, sim: WaveSim) {
			pads.forEach((pd, i) => {
				const x = pd.x + Math.sin(time * 0.15 + pd.ph) * 0.03,
					z = pd.z + Math.cos(time * 0.12 + pd.ph) * 0.03
				const h = sim.sample(x, z),
					gx = (sim.sample(x + 0.08, z) - sim.sample(x - 0.08, z)) / 0.16,
					gz = (sim.sample(x, z + 0.08) - sim.sample(x, z - 0.08)) / 0.16
				pd.mesh.position.set(x, h + 0.004, z)
				pd.mesh.rotation.set(gz * 3, pd.rot + Math.sin(time * 0.1 + pd.ph) * 0.05, -gx * 3, 'YXZ')
				uniforms.uPads.value[i].set(x, z, pd.r, 1)
			})
			for (const fl of flowers) {
				fl.g.rotation.set(
					Math.sin(time * 0.7 + fl.ph) * 0.04,
					time * 0.02 + fl.ph,
					Math.cos(time * 0.6 + fl.ph) * 0.04
				)
			}
		},
	}
}
