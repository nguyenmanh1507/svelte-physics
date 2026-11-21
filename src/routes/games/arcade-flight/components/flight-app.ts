// Ghép scene sân tập + ArcadeFlightController + reticle thành một app chạy trong `host`.
import * as THREE from 'three'

import {
	ArcadeFlightController,
	CONFIGS,
	ReticleOverlay,
	cloneConfig,
	loadB777Rig,
	loadSu57Rig,
	loadYak130Rig,
	type AircraftConfig,
	type AircraftKey,
	type AircraftRig,
	type FlightHudData,
} from '#lib/components/arcade-flight/index.js'

import { createFlightWorld } from './flight-world'
import { FlightTrail, type MinimapData } from './minimap'

export const AIRCRAFT: { key: AircraftKey; label: string }[] = [
	{ key: 'fighter', label: 'Su-57' },
	{ key: 'aerobatic', label: 'Yak-130' },
	{ key: 'transport', label: 'Boeing 777' },
]

export type FlightAppHud = FlightHudData & { rings: number; ringCount: number }

export type FlightAppOptions = {
	touch: boolean
	/** gọi ~20 lần/giây với ảnh chụp HUD */
	onHud: (hud: FlightAppHud) => void
}

const HUD_INTERVAL = 0.05

export async function createFlightApp(host: HTMLElement, { touch, onHud }: FlightAppOptions) {
	const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
	renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
	renderer.toneMapping = THREE.ACESFilmicToneMapping
	const canvas = renderer.domElement
	Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' })
	canvas.style.touchAction = 'none'
	host.appendChild(canvas)

	const world = createFlightWorld(renderer)
	// nạp song song; lỗi một model thì giải phóng các model còn lại trước khi ném lỗi
	const loaded = await Promise.allSettled([loadSu57Rig(), loadYak130Rig(), loadB777Rig()])
	const failed = loaded.find((r) => r.status === 'rejected')
	if (failed) {
		for (const r of loaded) if (r.status === 'fulfilled') r.value.dispose?.()
		world.dispose()
		renderer.dispose()
		canvas.remove()
		throw failed.reason
	}
	const [su57, yak130, b777] = loaded.map((r) => (r as PromiseFulfilledResult<AircraftRig>).value)

	const camera = new THREE.PerspectiveCamera(62, 1, 0.5, 40000)
	const configs: Record<AircraftKey, AircraftConfig> = {
		fighter: cloneConfig(CONFIGS.fighter),
		aerobatic: cloneConfig(CONFIGS.aerobatic),
		transport: cloneConfig(CONFIGS.transport),
	}
	const rigs: Record<AircraftKey, AircraftRig> = {
		fighter: su57,
		aerobatic: yak130,
		transport: b777,
	}
	let aircraft: AircraftKey = 'fighter'
	let rings = 0
	const trail = new FlightTrail()
	const forward = new THREE.Vector3()

	const flight = new ArcadeFlightController({
		scene: world.scene,
		camera,
		domElement: canvas,
		aircraft: rigs.fighter,
		config: configs.fighter,
		spawn: world.spawn,
		terrain: world.terrain,
		touch,
		onSpawn: () => {
			world.resetRings()
			trail.clear()
			rings = 0
		},
	})
	const reticle = new ReticleOverlay(host)
	// tiện debug / test tự động trong dev (giống window.__game của prototype)
	if (import.meta.env.DEV) Object.assign(window, { __flight: flight })

	const resize = () => {
		const w = Math.max(1, host.clientWidth)
		const h = Math.max(1, host.clientHeight)
		renderer.setSize(w, h, false)
		camera.aspect = w / h
		camera.updateProjectionMatrix()
		reticle.setSize(w, h)
	}
	const observer = new ResizeObserver(resize)
	observer.observe(host)
	resize()

	// biên dịch shader trước frame đầu để lúc bấm "Bắt đầu" không bị khựng
	flight.update(0)
	await renderer.compileAsync(world.scene, camera)

	let last = performance.now()
	let hudTimer = HUD_INTERVAL
	renderer.setAnimationLoop((now) => {
		const dt = (now - last) / 1000
		last = now
		flight.update(dt)
		if (!flight.crashed) {
			rings = world.updateRings(flight.position)
			// FlightTrail tự lọc theo quãng đường nên gọi mỗi frame được
			trail.push(flight.position)
		}
		renderer.render(world.scene, camera)
		reticle.draw(flight)
		hudTimer += dt
		if (hudTimer >= HUD_INTERVAL) {
			hudTimer = 0
			onHud({ ...flight.hud(), rings, ringCount: world.ringCount })
		}
	})

	return {
		flight,
		get aircraft() {
			return aircraft
		},
		/** config đang dùng của máy bay hiện tại */
		get config() {
			return configs[aircraft]
		},
		get defaultConfig() {
			return CONFIGS[aircraft]
		},
		start() {
			flight.start()
		},
		/** ảnh chụp cho mini map (tham chiếu trực tiếp, không sao chép) */
		minimap(): MinimapData {
			forward.set(0, 0, -1).applyQuaternion(flight.rig.object.quaternion)
			return {
				position: flight.position,
				forward,
				trail: trail.points,
				rings: world.course.rings,
				passed: world.passed,
				hills: world.course.hills,
			}
		},
		setAircraft(key: AircraftKey) {
			aircraft = key
			flight.setAircraft(rigs[key], configs[key])
		},
		applyConfig(c: AircraftConfig) {
			configs[aircraft] = c
			flight.setConfig(c)
			flight.say('Đã áp dụng config', 'ok')
		},
		dispose() {
			if (import.meta.env.DEV) Reflect.deleteProperty(window, '__flight')
			renderer.setAnimationLoop(null)
			observer.disconnect()
			flight.dispose()
			reticle.dispose()
			for (const rig of Object.values(rigs)) rig.dispose?.()
			world.dispose()
			renderer.dispose()
			canvas.remove()
		},
	}
}

export type FlightApp = Awaited<ReturnType<typeof createFlightApp>>
