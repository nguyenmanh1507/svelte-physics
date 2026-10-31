import Stats from 'stats.js'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import { createBuoy } from './buoy'
import { createFish } from './fish'
import { addIsland } from './island'
import { addLighthouse } from './lighthouse'
import { createRng } from './random'
import { createRocks } from './rocks'
import { addSeabed } from './seabed'
import { createClouds, createSkyTexture } from './sky'
import { createSplash } from './splash'
import { floorH, HALF } from './terrain'
import { createToonKit } from './toon-material'
import type { WorldContext } from './types'
import {
	addAnchor,
	addCoral,
	addSeabedRocks,
	addSeaweed,
	addShipwreck,
	addStarfish,
} from './underwater-props'
import { createWater } from './water'
import { createWaves } from './waves'

export type IsleSettings = {
	amp: number
	windDeg: number
	clarity: number
	toonStyle: boolean
}

type IsleOptions = {
	onWaterTap?: () => void
}

function createSun(sunDir: THREE.Vector3) {
	const sun = new THREE.DirectionalLight(0xfff4dc, 2.4)
	sun.position.copy(sunDir).multiplyScalar(120)
	sun.castShadow = true
	sun.shadow.mapSize.set(2048, 2048)
	Object.assign(sun.shadow.camera, {
		left: -70,
		right: 70,
		top: 70,
		bottom: -70,
		near: 10,
		far: 300,
	})
	sun.shadow.bias = -0.0008
	return sun
}

export function createIsleScene(host: HTMLElement, { onWaterTap }: IsleOptions = {}) {
	const renderer = new THREE.WebGLRenderer({ antialias: true })

	if (!renderer.capabilities.isWebGL2) {
		console.error('Not support webgl2')
		return null
	}

	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
	renderer.outputColorSpace = THREE.SRGBColorSpace
	renderer.shadowMap.enabled = true
	renderer.shadowMap.type = THREE.PCFShadowMap
	renderer.domElement.classList.add('block')
	host.append(renderer.domElement)

	const stats = new Stats()
	stats.showPanel(0)
	stats.dom.style.position = 'absolute' // mặc định là fixed, sẽ đè lên header
	stats.dom.style.left = 'auto' // panel điều khiển đã chiếm góc trái
	stats.dom.style.right = '0'
	host.append(stats.dom)

	const scene = new THREE.Scene()
	scene.background = createSkyTexture()

	const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 1, 900)
	camera.position.set(118, 92, 128)

	const controls = new OrbitControls(camera, renderer.domElement)
	controls.enableDamping = true
	controls.target.set(0, -1, 0)
	controls.minDistance = 40
	controls.maxDistance = 320
	controls.maxPolarAngle = 1.42 // Not allow go below box

	const sunDir = new THREE.Vector3(-0.55, 0.72, 0.42).normalize()
	const sun = createSun(sunDir)
	scene.add(sun, new THREE.HemisphereLight(0xcdefff, 0xf2d39a, 1.25))

	const toonKit = createToonKit()
	const waves = createWaves()
	const ctx: WorldContext = { scene, rng: createRng(7), toon: toonKit.toon }

	// rng dùng chung: đổi thứ tự các lời gọi dưới đây sẽ làm thay đổi bố cục thế giới
	addSeabed(ctx)
	const rocks = createRocks(ctx)
	addIsland(ctx, rocks)
	const beam = addLighthouse(ctx)
	addShipwreck(ctx)
	addAnchor(ctx)
	addStarfish(ctx)
	addCoral(ctx)
	addSeabedRocks(ctx, rocks)
	addSeaweed(ctx)
	const updateFish = createFish(ctx)
	const updateClouds = createClouds(ctx)
	const updateBuoy = createBuoy(ctx, waves)

	const water = createWater({ camera, sunDir, waves, timeUniform: toonKit.uniforms.uTime })
	const splash = createSplash({
		waves,
		surfaceRocks: rocks.surfaceRocks,
		toonUniform: water.uniforms.uToon,
	})
	scene.add(water.water, water.walls, splash.particles, beam)

	function setPass(opaque: boolean) {
		water.water.visible = water.walls.visible = splash.particles.visible = beam.visible = !opaque
	}

	// lần gọi đầu của observer cũng là lần đặt kích thước đầu tiên
	const observer = new ResizeObserver(() => {
		const { clientWidth: width, clientHeight: height } = host
		camera.aspect = width / height
		camera.updateProjectionMatrix()
		renderer.setSize(width, height)
		const res = renderer.getDrawingBufferSize(new THREE.Vector2())
		water.setSize(res.x, res.y)
		splash.setViewportHeight(res.y, camera.fov)
	})
	observer.observe(host)

	let simT = 0

	/* tap the water to drop a pebble */
	const canvas = renderer.domElement
	const ray = new THREE.Raycaster(),
		ndc = new THREE.Vector2(),
		plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
	let down: { x: number; y: number } | null = null
	const pointerListeners = new AbortController()
	const { signal } = pointerListeners
	canvas.addEventListener(
		'pointerdown',
		(e) => {
			down = { x: e.clientX, y: e.clientY }
		},
		{ signal }
	)
	canvas.addEventListener(
		'pointerup',
		(e) => {
			if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) {
				down = null
				return
			}
			down = null
			const r = canvas.getBoundingClientRect()
			ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
			ray.setFromCamera(ndc, camera)
			const p = new THREE.Vector3()
			if (!ray.ray.intersectPlane(plane, p) || Math.abs(p.x) > HALF - 1 || Math.abs(p.z) > HALF - 1)
				return
			if (floorH(p.x, p.z) > -0.3) return
			water.addRipple(p.x, p.z, simT)
			splash.dropPebble(p.x, p.z)
			onWaterTap?.()
		},
		{ signal }
	)

	let last = performance.now()
	renderer.setAnimationLoop((now) => {
		stats.begin()
		const dt = Math.min(0.05, (now - last) / 1000)
		last = now
		simT += dt
		toonKit.uniforms.uTime.value = simT
		waves.update(simT)

		splash.update(dt, simT)
		beam.rotation.y = simT * 0.7
		updateBuoy(simT)
		updateFish(simT)
		updateClouds(dt)

		controls.update()
		water.update()

		// pass 1 chụp màu + depth của phần đặc để shader nước đọc lại ở pass 2
		setPass(true)
		renderer.setRenderTarget(water.rt)
		renderer.render(scene, camera)
		setPass(false)
		renderer.setRenderTarget(null)
		renderer.render(scene, camera)
		stats.end()
	})

	return {
		applySettings({ amp, windDeg, clarity, toonStyle }: IsleSettings) {
			waves.setWind(amp, windDeg)
			water.uniforms.uClarity.value = 0.02 + (1 - clarity) * 0.22
			water.uniforms.uToon.value = toonStyle ? 1 : 0
			toonKit.uniforms.uCaustOn.value = toonStyle ? 1 : 0
		},
		sendBigWave() {
			waves.sendBigWave(simT)
		},
		dispose() {
			renderer.setAnimationLoop(null)
			observer.disconnect()
			pointerListeners.abort()
			controls.dispose()
			scene.traverse((object) => {
				if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
					object.geometry.dispose()
					object.material.dispose()
				}
			})
			if (scene.background instanceof THREE.Texture) scene.background.dispose()
			toonKit.dispose()
			water.dispose()
			sun.dispose()
			renderer.dispose()
			renderer.domElement.remove()
			stats.dom.remove()
		},
	}
}

export type IsleScene = NonNullable<ReturnType<typeof createIsleScene>>
