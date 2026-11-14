import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import { createGround, createPebbles } from './ground'
import { createLiquid } from './liquid'
import { mulberry32 } from './noise'
import { createRain } from './rain'
import { createSky, createSkyUniforms } from './sky'
import { groundH, inRoamRange, LIQUID_LEVEL } from './terrain'
import { createWaves } from './waves'

export type TitanSettings = {
	/** 0..4: nhân biên độ sóng */
	wind: number
	/** 0..1: mật độ mưa metan */
	rain: number
	/** 0.4..2.5: nhân mật độ sương */
	haze: number
}

const BASE_FOG_DENSITY = 0.0018
const EYE_HEIGHT = 1.3
const MOVE_KEYS: Record<string, [forward: number, right: number]> = {
	KeyW: [1, 0],
	KeyS: [-1, 0],
	KeyD: [0, 1],
	KeyA: [0, -1],
}

export function createTitanScene(host: HTMLElement) {
	const renderer = new THREE.WebGLRenderer({ antialias: true })
	if (!renderer.capabilities.isWebGL2) {
		renderer.dispose()
		return null
	}
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
	renderer.outputColorSpace = THREE.SRGBColorSpace
	renderer.domElement.classList.add('block')
	renderer.domElement.style.touchAction = 'none'
	host.append(renderer.domElement)

	const scene = new THREE.Scene()
	const camera = new THREE.PerspectiveCamera(50, 1, 0.3, 4000)
	camera.position.set(24, 3.4, 98)

	// Mặt Trời thấp, nằm phía bên kia hồ so với vị trí xuất phát để có vệt sáng trên mặt hồ
	const sunDir = new THREE.Vector3(-0.25, 0.42, -0.87).normalize()
	const skyUniforms = createSkyUniforms(sunDir)
	const sky = createSky(skyUniforms)
	const fog = new THREE.FogExp2(skyUniforms.uHorizon.value, BASE_FOG_DENSITY)
	scene.fog = fog

	// ánh sáng gần như khuếch tán hoàn toàn qua lớp sương cam: trời chiếu là chính, nắng trực tiếp yếu,
	// nên không dùng shadow map. (Thực tế Titan tối hơn Trái Đất ~100 lần; ở đây đã "phơi sáng" lại.)
	const sun = new THREE.DirectionalLight('#ffcf94', 1.1)
	sun.position.copy(sunDir)
	scene.add(sun, new THREE.HemisphereLight('#f0b672', '#5c3a1c', 1.9))

	const time = { value: 0 }
	const waves = createWaves()
	const rng = mulberry32(1655) // năm Huygens tìm ra Titan
	const ground = createGround()
	const pebbles = createPebbles(rng)
	const liquid = createLiquid({ camera, waves, sky: skyUniforms, timeUniform: time })
	const rain = createRain(time, rng)
	scene.add(sky, ground, pebbles, liquid.mesh, rain.lines)

	const controls = new OrbitControls(camera, renderer.domElement)
	controls.enableDamping = true
	controls.screenSpacePanning = false
	controls.target.set(-6, LIQUID_LEVEL + EYE_HEIGHT, 34)
	controls.minDistance = 4
	controls.maxDistance = 150
	controls.maxPolarAngle = 1.55

	const keys = new Set<string>()
	const listeners = new AbortController()
	const { signal } = listeners
	window.addEventListener(
		'keydown',
		(e) => {
			// không cướp phím khi đang gõ/kéo thanh trượt hoặc dùng phím tắt trình duyệt
			if (e.ctrlKey || e.metaKey || e.altKey || e.target instanceof HTMLInputElement) return
			if (e.code in MOVE_KEYS || e.code.startsWith('Shift')) keys.add(e.code)
		},
		{ signal }
	)
	window.addEventListener('keyup', (e) => keys.delete(e.code), { signal })
	window.addEventListener('blur', () => keys.clear(), { signal })

	const forward = new THREE.Vector3(),
		step = new THREE.Vector3(),
		lastValid = controls.target.clone()

	function moveWithKeys(dt: number) {
		let f = 0,
			r = 0
		for (const code of keys) {
			const move = MOVE_KEYS[code]
			if (move) {
				f += move[0]
				r += move[1]
			}
		}
		if (f === 0 && r === 0) return
		camera.getWorldDirection(forward).setY(0).normalize()
		const speed = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 40 : 14) * dt
		// phải = forward xoay 90° quanh trục y
		step.set(forward.x * f - forward.z * r, 0, forward.z * f + forward.x * r)
		step.normalize().multiplyScalar(speed)
		controls.target.add(step)
		camera.position.add(step)
	}

	/** giữ điểm nhìn quanh hồ, bám theo mặt đất, và không cho camera chui xuống đất hay chất lỏng */
	function constrainCamera(dt: number) {
		const target = controls.target
		if (inRoamRange(target.x, target.z)) lastValid.copy(target)
		else {
			// ra khỏi vùng cho phép: trả cả điểm nhìn lẫn camera về chỗ hợp lệ gần nhất đã biết
			step.set(lastValid.x - target.x, 0, lastValid.z - target.z)
			target.add(step)
			camera.position.add(step)
		}
		const wantY = Math.max(groundH(target.x, target.z), LIQUID_LEVEL) + EYE_HEIGHT
		const dy = (wantY - target.y) * Math.min(1, dt * 6)
		target.y += dy
		camera.position.y += dy

		const { x, z } = camera.position
		const floor = Math.max(groundH(x, z), LIQUID_LEVEL + waves.maxHeight()) + 0.9
		if (camera.position.y < floor) camera.position.y = floor
	}

	const size = new THREE.Vector2()
	// lần gọi đầu của observer cũng là lần đặt kích thước đầu tiên
	const observer = new ResizeObserver(() => {
		const { clientWidth: width, clientHeight: height } = host
		if (width === 0 || height === 0) return
		camera.aspect = width / height
		camera.updateProjectionMatrix()
		renderer.setSize(width, height)
		renderer.getDrawingBufferSize(size)
		liquid.setSize(size.x, size.y)
	})
	observer.observe(host)

	function setPass(opaque: boolean) {
		liquid.mesh.visible = rain.lines.visible = !opaque
	}

	let last = performance.now()
	renderer.setAnimationLoop((now) => {
		// chặn dt để quay lại tab ẩn không nhảy một bước khổng lồ
		const dt = Math.min(0.05, (now - last) / 1000)
		last = now
		time.value += dt
		skyUniforms.uSkyTime.value = time.value

		moveWithKeys(dt)
		controls.update()
		constrainCamera(dt)
		sky.position.copy(camera.position)
		rain.uniforms.uCamPos.value.copy(camera.position)
		liquid.update()

		// pass 1: phần đặc (đất, sỏi, trời) -> màu + depth; pass 2: vẽ lại kèm chất lỏng và mưa
		setPass(true)
		renderer.setRenderTarget(liquid.rt)
		renderer.render(scene, camera)
		setPass(false)
		renderer.setRenderTarget(null)
		renderer.render(scene, camera)
	})

	return {
		applySettings({ wind, rain: rainAmount, haze }: TitanSettings) {
			waves.state.amp = wind
			liquid.uniforms.uRain.value = rainAmount
			rain.setIntensity(rainAmount)
			fog.density = liquid.uniforms.uFogDensity.value = BASE_FOG_DENSITY * haze
		},
		dispose() {
			renderer.setAnimationLoop(null)
			observer.disconnect()
			listeners.abort()
			controls.dispose()
			scene.traverse((object) => {
				if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
					object.geometry.dispose()
					object.material.dispose()
				}
			})
			liquid.dispose()
			sun.dispose()
			renderer.dispose()
			renderer.domElement.remove()
		},
	}
}

export type TitanScene = NonNullable<ReturnType<typeof createTitanScene>>
