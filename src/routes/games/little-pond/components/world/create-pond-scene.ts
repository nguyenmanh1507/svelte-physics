import * as THREE from 'three'
import { createBlades } from './blades'
import { attachPondInput, createCameraRig } from './camera-rig'
import { createFood } from './food'
import { createKoiPond } from './koi'
import { scare } from './koi-steering'
import { createBankRocks, createGround, createSky } from './landscape'
import { createLotus } from './lotus'
import { createPondUniforms, UNDER_LAYER } from './shading'
import { depthAt, randomInPond } from './terrain'
import { createWater } from './water'
import { createWaveSim, DEPTH_SCALE, SIM_N, waveSpeed } from './wave-sim'

export type PondSettings = {
	wind: boolean
	caustics: boolean
	clarity: number // 0 đục .. 1 trong
}

export type PondStats = {
	speedMid: number // m/s, giữa ao
	speedEdge: number // m/s, sát bờ
	depthScale: number
	grid: number
	substeps: number
	koi: number
	food: number
}

type PondOptions = {
	onStats?: (stats: PondStats) => void
}

const REFRACTION_CLEAR = 0x3a4a2c
const STATS_EVERY = 15 // frame

export function createPondScene(host: HTMLElement, { onStats }: PondOptions = {}) {
	const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
	if (!renderer.capabilities.isWebGL2) {
		renderer.dispose()
		return null
	}
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
	// mọi shader tự tính màu cuối (không qua colorspace_fragment)
	renderer.outputColorSpace = THREE.LinearSRGBColorSpace
	const canvas = renderer.domElement
	canvas.classList.add('block', 'h-full', 'w-full', 'touch-none', 'cursor-crosshair')
	host.append(canvas)

	const uniforms = createPondUniforms()
	const sim = createWaveSim(depthAt)
	const scene = new THREE.Scene()
	const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 160)
	const rig = createCameraRig(camera)

	const sky = createSky(uniforms)
	const lotus = createLotus(uniforms)
	const koi = createKoiPond(uniforms)
	const food = createFood(uniforms, sim)
	const water = createWater(uniforms, sim, camera)
	scene.add(
		sky,
		createGround(uniforms),
		createBankRocks(uniforms),
		createBlades(uniforms),
		lotus.group,
		koi.group,
		food.mesh,
		water.mesh
	)
	const obstacles = lotus.pads.map(({ x, z }) => ({ x, z }))
	const drop = sim.addDrop

	const settings: PondSettings = { wind: true, caustics: true, clarity: 0.8 }

	const detachInput = attachPondInput(canvas, camera, rig, {
		onTap: (x, z) => food.drop(x, z, 6),
		onStir: (x, z) => {
			sim.addDrop(x, z, -0.004, 0.09)
			scare(koi.states, x, z, 1.2)
		},
	})

	const observer = new ResizeObserver(() => {
		const { clientWidth: w, clientHeight: h } = host
		if (!w || !h) return
		renderer.setSize(w, h, false)
		camera.aspect = w / h
		camera.updateProjectionMatrix()
		const size = renderer.getDrawingBufferSize(new THREE.Vector2())
		water.setSize(size.x, size.y)
	})
	observer.observe(host)

	// vài gợn sóng ban đầu cho mặt nước khỏi phẳng lì
	for (let i = 0; i < 5; i++) {
		const p = randomInPond(0.2)
		sim.addDrop(p.x, p.z, -0.006, 0.1)
	}

	let last = performance.now(),
		time = 0,
		frame = 0
	renderer.setAnimationLoop((now) => {
		const dt = Math.min((now - last) / 1000, 1 / 30)
		last = now
		time += dt
		uniforms.uTime.value = time

		// gió: gợn lăn tăn rải rác + lớp noise trên shader (bật/tắt mượt)
		if (settings.wind && Math.random() < dt * 4) {
			const p = randomInPond(0.05)
			sim.addDrop(p.x, p.z, -0.0015, 0.05 + Math.random() * 0.05)
		}
		const wind = water.uniforms.uWind
		wind.value += ((settings.wind ? 1 : 0.25) - wind.value) * Math.min(1, dt * 2)

		const substeps = sim.step(dt)
		water.updateGeometry()
		koi.update(dt, { food: food.items, obstacles, drop })
		lotus.update(time, sim)
		food.update(dt)

		rig.place()
		sky.position.copy(camera.position)

		// pass 1: caustics; pass 2: mọi thứ dưới nước vào refraction buffer; pass 3: màn hình
		water.renderCaustics(renderer)
		camera.layers.set(UNDER_LAYER)
		renderer.setRenderTarget(water.refraction)
		renderer.setClearColor(REFRACTION_CLEAR, 1)
		renderer.clear()
		renderer.render(scene, camera)
		camera.layers.set(0)
		renderer.setRenderTarget(null)
		renderer.render(scene, camera)

		if (onStats && frame++ % STATS_EVERY === 0) {
			onStats({
				speedMid: waveSpeed(0.55),
				speedEdge: waveSpeed(0.08),
				depthScale: DEPTH_SCALE,
				grid: SIM_N,
				substeps,
				koi: koi.states.length,
				food: food.items.length,
			})
		}
	})

	return {
		applySettings(next: PondSettings) {
			Object.assign(settings, next)
			uniforms.uSun.value = next.caustics ? 1 : 0
			water.uniforms.uClear.value = next.clarity
		},
		feed() {
			const p = randomInPond(0.25)
			food.drop(p.x, p.z, 10)
		},
		throwStone() {
			const p = randomInPond(0.3)
			sim.addDrop(p.x, p.z, -0.05, 0.16)
			scare(koi.states, p.x, p.z, 2.0)
		},
		dispose() {
			renderer.setAnimationLoop(null)
			observer.disconnect()
			detachInput()
			scene.traverse((o) => {
				if (o instanceof THREE.Mesh) {
					o.geometry.dispose()
					;(o.material as THREE.Material).dispose()
				}
			})
			water.dispose()
			renderer.dispose()
			canvas.remove()
		},
	}
}

export type PondScene = NonNullable<ReturnType<typeof createPondScene>>
