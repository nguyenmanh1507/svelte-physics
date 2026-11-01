import * as THREE from 'three'

import type { SurfaceRock } from './rocks'
import { floorH, HALF } from './terrain'
import type { Waves } from './waves'

type SplashOptions = {
	waves: Waves
	surfaceRocks: SurfaceRock[]
	toonUniform: { value: number }
}

export function createSplash({ waves, surfaceRocks, toonUniform }: SplashOptions) {
	const { W, windDir, waveHeight } = waves
	let simT = 0

	const MAXP = 4000
	const pGeo = new THREE.BufferGeometry()
	const pPos = new Float32Array(MAXP * 3),
		pSize = new Float32Array(MAXP),
		pLife = new Float32Array(MAXP)
	const pVel = new Float32Array(MAXP * 3),
		pAge = new Float32Array(MAXP),
		pMax = new Float32Array(MAXP)
	pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3))
	pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1))
	pGeo.setAttribute('aLife', new THREE.BufferAttribute(pLife, 1))
	const pMat = new THREE.ShaderMaterial({
		transparent: true,
		depthWrite: false,
		uniforms: { uScale: { value: 1 }, uToon: toonUniform },
		vertexShader: /* glsl */ `
	    attribute float aSize; attribute float aLife;
	    uniform float uScale; varying float vLife;
	    void main() {
	      vLife = aLife;
	      vec4 mv = modelViewMatrix * vec4(position, 1.0);
	      gl_PointSize = aLife > 0.0 ? aSize * uScale / -mv.z : 0.0;
	      gl_Position = projectionMatrix * mv;
	    }`,
		fragmentShader: /* glsl */ `
	    uniform float uToon; varying float vLife;
	    void main() {
	      vec2 d = gl_PointCoord * 2.0 - 1.0;
	      float r = dot(d, d);
	      if (r > 1.0 || vLife <= 0.0) discard;
	      float shade = mix(1.0 - 0.25 * smoothstep(0.0, 1.0, length(d - vec2(-0.35, 0.35))), 1.0 - 0.2 * step(0.55, length(d - vec2(-0.35, 0.35))), uToon);
	      vec3 c = mix(vec3(0.72, 0.92, 1.0), vec3(1.0), shade);
	      float a = smoothstep(0.0, 0.25, vLife);
	      gl_FragColor = vec4(c, a);
	      #include <colorspace_fragment>
	    }`,
	})
	const particles = new THREE.Points(pGeo, pMat)
	particles.frustumCulled = false
	particles.renderOrder = 3
	let pHead = 0
	function emit(
		x: number,
		y: number,
		z: number,
		vx: number,
		vy: number,
		vz: number,
		size: number,
		life: number
	) {
		const i = pHead
		pHead = (pHead + 1) % MAXP
		pPos.set([x, y, z], i * 3)
		pVel.set([vx, vy, vz], i * 3)
		pSize[i] = size
		pAge[i] = 0
		pMax[i] = life
		pLife[i] = 1
	}
	function burst(x: number, z: number, nx: number, nz: number, strength: number, count: number) {
		const wd = windDir()
		const y0 = waveHeight(x, z, simT)
		for (let k = 0; k < count; k++) {
			const up = (5 + Math.random() * 7) * strength
			const side = (Math.random() - 0.5) * 3.2
			emit(
				x + (Math.random() - 0.5) * 1.6,
				y0 + Math.random() * 0.6,
				z + (Math.random() - 0.5) * 1.6,
				nx * (1.5 + Math.random() * 2.5) + wd.x * 2.2 * strength - nz * side,
				up,
				nz * (1.5 + Math.random() * 2.5) + wd.y * 2.2 * strength + nx * side,
				(0.55 + Math.random() * 1.0) * (0.8 + strength * 0.35),
				0.7 + Math.random() * 0.8
			)
		}
	}

	/* splash emitters: the island shoreline (found by bisection on the seabed) and the sea stacks */
	const emitters: {
		x: number
		z: number
		nx: number
		nz: number
		prev: number
		cool: number
	}[] = []
	for (let i = 0; i < 40; i++) {
		const a = (i / 40) * Math.PI * 2,
			c = Math.cos(a),
			s = Math.sin(a)
		let lo = 2,
			hi = 24
		for (let k = 0; k < 30; k++) {
			const m = (lo + hi) / 2
			if (floorH(c * m, s * m) > 0) lo = m
			else hi = m
		}
		const r = Math.max(lo, 9.5)
		emitters.push({ x: c * r, z: s * r, nx: c, nz: s, prev: 0, cool: 0 })
	}
	for (const rk of surfaceRocks) {
		if (Math.hypot(rk.x, rk.z) < 12) continue
		for (let i = 0; i < 8; i++) {
			const a = (i / 8) * Math.PI * 2
			emitters.push({
				x: rk.x + Math.cos(a) * rk.r,
				z: rk.z + Math.sin(a) * rk.r,
				nx: Math.cos(a),
				nz: Math.sin(a),
				prev: 0,
				cool: 0,
			})
		}
	}

	function dropPebble(x: number, z: number) {
		for (let k = 0; k < 26; k++) {
			const a = Math.random() * Math.PI * 2,
				sp = 1 + Math.random() * 2.5
			emit(
				x,
				waveHeight(x, z, simT) + 0.2,
				z,
				Math.cos(a) * sp,
				6 + Math.random() * 6,
				Math.sin(a) * sp,
				0.9 + Math.random() * 1.0,
				0.8 + Math.random() * 0.6
			)
		}
	}

	function setViewportHeight(height: number, fov: number) {
		pMat.uniforms.uScale.value = (height * 0.5) / Math.tan(THREE.MathUtils.degToRad(fov / 2))
	}

	function update(dt: number, t: number) {
		simT = t

		// shoreline splashes when a crest arrives
		const wd = windDir()
		const thr = 0.55 * W.amp + 0.15
		for (const e of emitters) {
			const h = waveHeight(e.x, e.z, simT)
			e.cool -= dt
			const facing = -(e.nx * wd.x + e.nz * wd.y)
			if (h > thr && e.prev <= thr && e.cool <= 0 && facing > -0.15 && W.amp + W.bigA > 0.15) {
				const strength = Math.min(
					1.8,
					0.45 + 0.35 * W.amp + 0.25 * Math.max(0, facing) + 0.35 * Math.min(W.bigA, 3)
				)
				burst(
					e.x,
					e.z,
					e.nx,
					e.nz,
					strength,
					Math.round(
						4 + 10 * Math.max(0, facing + 0.3) * (0.5 + W.amp * 0.5) + 9 * Math.min(W.bigA, 3)
					)
				)
				e.cool = 0.5
			}
			e.prev = h
		}

		// integrate particles
		for (let i = 0; i < MAXP; i++) {
			if (pLife[i] <= 0) continue
			pAge[i] += dt
			const o = i * 3
			pVel[o + 1] -= 16 * dt
			pVel[o] *= 0.995
			pVel[o + 2] *= 0.995
			pPos[o] += pVel[o] * dt
			pPos[o + 1] += pVel[o + 1] * dt
			pPos[o + 2] += pVel[o + 2] * dt
			const life = 1 - pAge[i] / pMax[i]
			const out = Math.abs(pPos[o]) > HALF + 2 || Math.abs(pPos[o + 2]) > HALF + 2
			const sunk = pVel[o + 1] < 0 && pPos[o + 1] < waveHeight(pPos[o], pPos[o + 2], simT) - 0.3
			pLife[i] = life <= 0 || out || sunk ? 0 : life
		}
		pGeo.attributes.position.needsUpdate = true
		pGeo.attributes.aLife.needsUpdate = true
		pGeo.attributes.aSize.needsUpdate = true
	}

	return { particles, dropPebble, setViewportHeight, update }
}
