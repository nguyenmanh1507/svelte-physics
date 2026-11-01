import * as THREE from 'three'

import { floorH, HALF } from './terrain'
import {
	WATER_SURFACE_FRAGMENT,
	WATER_SURFACE_VERTEX,
	WATER_WALL_FRAGMENT,
	WATER_WALL_VERTEX,
} from './water-shaders'
import type { Waves } from './waves'

type WaterOptions = {
	camera: THREE.PerspectiveCamera
	sunDir: THREE.Vector3
	waves: Waves
	timeUniform: { value: number }
}

export function createWater({ camera, sunDir, waves, timeUniform }: WaterOptions) {
	const { W, uWaves, uWaveA } = waves

	const rt = new THREE.WebGLRenderTarget(1, 1, {
		type: THREE.HalfFloatType,
		depthTexture: new THREE.DepthTexture(1, 1, THREE.FloatType),
	})

	if (rt.depthTexture) rt.depthTexture.format = THREE.DepthFormat

	const C = {
		shallow: new THREE.Color('#5ce6d6'),
		deep: new THREE.Color('#1468a8'),
		foam: new THREE.Color('#ffffff'),
		sky: new THREE.Color('#c9f1ff'),
		sunCol: new THREE.Color('#fff6dc'),
	}
	const waterUniforms = {
		uTime: timeUniform,
		uAmp: { value: W.amp },
		uBigT: { value: -100 },
		uBigA: { value: 0 },
		uWaves: { value: uWaves },
		uWaveA: { value: uWaveA },
		uRipples: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, -100, 0)) },
		tColor: { value: rt.texture },
		tDepth: { value: rt.depthTexture },
		uRes: { value: new THREE.Vector2(1, 1) },
		uNear: { value: camera.near },
		uFar: { value: camera.far },
		uCamPos: { value: new THREE.Vector3() },
		uCamFwd: { value: new THREE.Vector3() },
		uSunDir: { value: sunDir },
		uSunCol: { value: C.sunCol },
		uShallow: { value: C.shallow },
		uDeep: { value: C.deep },
		uFoamCol: { value: C.foam },
		uSkyCol: { value: C.sky },
		uClarity: { value: 0.07 },
		uToon: { value: 1 },
	}

	/* water surface */
	const waterMat = new THREE.ShaderMaterial({
		uniforms: waterUniforms,
		side: THREE.DoubleSide,
		vertexShader: WATER_SURFACE_VERTEX,
		fragmentShader: WATER_SURFACE_FRAGMENT,
	})
	const waterGeo = new THREE.PlaneGeometry(100, 100, 280, 280)
	waterGeo.rotateX(-Math.PI / 2)
	const water = new THREE.Mesh(waterGeo, waterMat)
	water.renderOrder = 1
	water.frustumCulled = false

	/* the four cut faces of the water volume */
	const wallMat = new THREE.ShaderMaterial({
		uniforms: waterUniforms,
		side: THREE.DoubleSide,
		vertexShader: WATER_WALL_VERTEX,
		fragmentShader: WATER_WALL_FRAGMENT,
	})
	const walls = new THREE.Group()
	{
		const N = 140
		const make = (f: (s: number) => [x: number, z: number]) => {
			const pos: number[] = [],
				top: number[] = [],
				fl: number[] = [],
				idx: number[] = []
			for (let i = 0; i <= N; i++) {
				const [x, z] = f(-HALF + (100 * i) / N),
					fh = floorH(x, z)
				pos.push(x, 0, z, x, 0, z)
				top.push(0, 1)
				fl.push(fh, fh)
				if (i > 0) {
					const a = (i - 1) * 2,
						b = i * 2
					idx.push(a, b, a + 1, a + 1, b, b + 1)
				}
			}
			const g = new THREE.BufferGeometry()
			g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
			g.setAttribute('aTop', new THREE.Float32BufferAttribute(top, 1))
			g.setAttribute('aFloor', new THREE.Float32BufferAttribute(fl, 1))
			g.setIndex(idx)
			const m = new THREE.Mesh(g, wallMat)
			m.frustumCulled = false
			m.renderOrder = 2
			return m
		}
		walls.add(
			make((s) => [s, HALF]),
			make((s) => [HALF, -s]),
			make((s) => [-s, -HALF]),
			make((s) => [-HALF, s])
		)
	}

	let ripIdx = 0
	function addRipple(x: number, z: number, t: number) {
		waterUniforms.uRipples.value[ripIdx].set(x, z, t, 1)
		ripIdx = (ripIdx + 1) % 8
	}

	function setSize(width: number, height: number) {
		rt.setSize(width, height)
		waterUniforms.uRes.value.set(width, height)
	}

	const fwd = new THREE.Vector3()
	function update() {
		waterUniforms.uAmp.value = W.amp
		waterUniforms.uBigT.value = W.bigT
		waterUniforms.uBigA.value = W.bigA
		camera.getWorldDirection(fwd)
		waterUniforms.uCamPos.value.copy(camera.position)
		waterUniforms.uCamFwd.value.copy(fwd)
	}

	function dispose() {
		rt.depthTexture?.dispose()
		rt.dispose()
	}

	return { water, walls, rt, uniforms: waterUniforms, addRipple, setSize, update, dispose }
}

export type Water = ReturnType<typeof createWater>
