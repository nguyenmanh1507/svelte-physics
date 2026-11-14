// Renderer setup and frame loop, following Minamo's main.js. Frame order (docs/WATER_SIMULATION_GUIDE.md §1):
//   1 ocean compute (FFT, mips, caustics) + per-pixel waterline test
//   2 opaque scene into an HDR target
//   3 water surface: back faces, then front faces, each after a backdrop copy
//   4 post stack (shafts, underwater compositing, bloom, exposure, tone mapping) -> canvas
import * as THREE from 'three/webgpu'
import { params, applyUrl, QUALITY } from '../water/params.js'
import { Ocean } from '../water/ocean/ocean.js'
import { makeOceanNodes, updateOceanUniforms } from '../water/ocean/oceanNodes.js'
import { makeWaterMaterial, makeRadialGrid } from '../water/ocean/waterMaterial.js'
import { loadSky } from '../water/sky.js'
import { makeParticles } from '../water/particles.js'
import { Post } from '../water/post/post.js'
import { LensDrops } from '../water/post/lensDrops.js'
import { buildSeabed } from './seabed'
import { buildSubMesh } from './subMesh'
import { terrainHeight } from './terrain'
import { initialSub, stepSub } from './submarine'
import { attachInput, inputFromKeys } from './input'
import { CHASE, chaseTarget, stepChase } from './chaseCamera'
import { clampDt, renderSize } from './sizing'
import { createFpsMeter, type FpsReading } from './fpsMeter'
import { applyStyleParams, otherStyle, type SavedStyleParams, type Style } from '../toon/style'
import { makeToonWaterMaterial } from '../toon/toonWater'
import { toonSkyBackground } from '../toon/toonSky'

export interface App {
	setStyle(style: Style): void
	dispose(): void
}

export interface AppOptions {
	/** tuning panel, free-fly camera on Space and a camera/ocean line through onStatus */
	debug: boolean
	/** rendering style to start in */
	style: Style
	onStatus(text: string): void
	/** called about twice a second with the measured frame rate */
	onFps?(reading: FpsReading): void
	/** element the debug panel is placed in (default: lil-gui's fixed top-right corner) */
	guiContainer?: HTMLElement
}

export const WEBGPU_UNAVAILABLE = 'WebGPU not available'

/** the parts of three's WebGPUBackend used here, which @types/three does not expose on renderer.backend */
interface WebGPUBackendInternals {
	isWebGPUBackend?: boolean
	device: GPUDevice
	get(object: unknown): { texture: GPUTexture }
}

type SceneTarget = THREE.RenderTarget & { needsPostBind: boolean }

const MAX_PIXEL_RATIO = 2

export async function createApp(canvas: HTMLCanvasElement, opts: AppOptions): Promise<App> {
	if (!navigator.gpu) throw new Error(WEBGPU_UNAVAILABLE)
	applyUrl(params)

	const renderer = new THREE.WebGPURenderer({
		antialias: false,
		powerPreference: 'high-performance',
	})
	await renderer.init()
	const backend = renderer.backend as unknown as WebGPUBackendInternals
	if (!backend.isWebGPUBackend) {
		renderer.dispose()
		throw new Error(WEBGPU_UNAVAILABLE)
	}
	const device: GPUDevice = backend.device
	renderer.toneMapping = THREE.NoToneMapping
	renderer.shadowMap.enabled = true
	renderer.shadowMap.type = THREE.PCFShadowMap

	// everything below registers its teardown here, so a failed or abandoned start-up cleans up too
	let disposed = false
	const cleanups: (() => void)[] = []
	let setStyle: (style: Style) => void = () => {}
	const dispose = () => {
		if (disposed) return
		disposed = true
		for (const fn of cleanups.reverse()) fn()
		renderer.dispose()
		device.destroy()
	}
	void device.lost.then((info) => {
		if (!disposed) opts.onStatus('GPU device lost: ' + info.message)
	})

	try {
		const context = canvas.getContext('webgpu') as WebGPUCanvasContext | null
		if (!context) throw new Error(WEBGPU_UNAVAILABLE)
		const ctx = context
		const format = navigator.gpu.getPreferredCanvasFormat()
		ctx.configure({
			device,
			format,
			alphaMode: 'opaque',
			usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
		})
		cleanups.push(() => ctx.unconfigure())

		opts.onStatus('loading sky…')
		const sky = await loadSky(params.hdri)
		const sun = sky.sun
		const scene = new THREE.Scene()
		scene.background = sky.texture
		scene.environment = sky.texture

		const ocean = new Ocean(device, params)
		const O = makeOceanNodes(ocean, params)
		// the water is rendered after the opaque scene from its own scenes (back faces, then front faces)
		// with a backdrop copy (colour + linear depth) before each, see Post.copyBackdrop
		const external = (gpuTexture: GPUTexture, float32 = false) => {
			const t = new THREE.ExternalTexture(gpuTexture)
			if (float32) {
				t.type = THREE.FloatType
				t.format = THREE.RedFormat
				t.minFilter = t.magFilter = THREE.NearestFilter
			}
			return t
		}
		const placeholder = (textureFormat: GPUTextureFormat) =>
			device.createTexture({
				size: [1, 1],
				format: textureFormat,
				usage: GPUTextureUsage.TEXTURE_BINDING,
			})
		// one water material pair per style: same grid and wave function, different shading
		const waters = {
			realistic: makeWaterMaterial(
				O,
				sky.texture,
				params,
				external(placeholder('rgba16float')),
				external(placeholder('r32float'), true)
			),
			toon: makeToonWaterMaterial(
				O,
				params,
				external(placeholder('rgba16float')),
				external(placeholder('r32float'), true)
			),
		}
		const waterGrid = makeRadialGrid()
		const waterMeshes = [new THREE.Mesh(waterGrid), new THREE.Mesh(waterGrid)]
		const waterScenes = waterMeshes.map((mesh) => {
			mesh.frustumCulled = false
			return new THREE.Scene().add(mesh)
		})

		const sunLight = new THREE.DirectionalLight(0xffffff, 1)
		sunLight.castShadow = true
		sunLight.shadow.mapSize.set(4096, 4096)
		const sc = sunLight.shadow.camera
		sc.left = -45
		sc.right = 45
		sc.top = 45
		sc.bottom = -45
		sc.near = 1
		sc.far = 400
		sunLight.shadow.bias = -0.0004
		sunLight.shadow.normalBias = 0.03
		scene.add(sunLight, sunLight.target)

		opts.onStatus('loading scene…')
		const seabed = buildSeabed(scene, O)
		const submarine = buildSubMesh(O)
		const subMesh = submarine.group
		scene.add(subMesh)

		// ------------------------------------------------------------ style
		const toonSky = toonSkyBackground(O.U)
		const savedStyleParams: SavedStyleParams = {}
		let style: Style = 'realistic'
		const showStyle = (next: Style) => {
			applyStyleParams(params, style, next, savedStyleParams)
			style = next
			waterMeshes[0].material = waters[next].backMaterial
			waterMeshes[1].material = waters[next].material
			seabed.setStyle(next)
			submarine.setStyle(next)
			scene.background = next === 'toon' ? null : sky.texture
			scene.backgroundNode = next === 'toon' ? toonSky : null
		}
		showStyle(opts.style)
		const particles = makeParticles(O)
		scene.add(particles.mesh)

		const camera = new THREE.PerspectiveCamera(params.fov, 16 / 9, 0.05, 20000)
		// WebGPU clip z in [0, 1] from the start: post.prepare (the waterline test) unprojects before the
		// first three.js render, which would otherwise still see the WebGL convention on the first frame
		camera.coordinateSystem = THREE.WebGPUCoordinateSystem

		const post = new Post(device, ocean, format)
		const drops = new LensDrops()

		// ------------------------------------------------------------ sizing
		let rt: SceneTarget | null = null
		let W = 0
		let H = 0
		let cssW = 0
		let cssH = 0
		function resize(w: number, h: number) {
			cssW = w
			cssH = h
			canvas.width = Math.max(1, w)
			canvas.height = Math.max(1, h)
			const size = renderSize(w, h, params.renderScale)
			if (rt && size.width === W && size.height === H) return
			W = size.width
			H = size.height
			if (rt) rt.dispose()
			const target = new THREE.RenderTarget(W, H, {
				type: THREE.HalfFloatType,
				depthBuffer: true,
			}) as SceneTarget
			target.depthTexture = new THREE.DepthTexture(W, H)
			target.needsPostBind = true
			rt = target
			camera.aspect = w / Math.max(h, 1)
			camera.updateProjectionMatrix()
			post.resize(W, H)
			for (const water of Object.values(waters)) {
				water.setBackdrop(external(post.backdrop))
				water.setNearS(external(post.nearTex, true))
			}
		}
		const fitWindow = () => {
			const ratio = Math.min(devicePixelRatio, MAX_PIXEL_RATIO)
			resize(Math.round(canvas.clientWidth * ratio), Math.round(canvas.clientHeight * ratio))
		}
		// the canvas fills its container (not the window): follow the container's size
		const resizeObserver = new ResizeObserver(fitWindow)
		resizeObserver.observe(canvas)
		cleanups.push(() => resizeObserver.disconnect())
		cleanups.push(() => rt?.dispose())
		fitWindow()

		// ------------------------------------------------------------ submarine + cameras
		const input = attachInput(window, canvas)
		cleanups.push(() => input.dispose())
		let sub = initialSub()
		let cam = chaseTarget(sub, input.orbit)

		// debug free-fly camera (Minamo): WASD QE, Shift/Ctrl, drag to look
		let freeFly = false
		let flyYaw = 0
		let flyPitch = 0
		const flyVel = new THREE.Vector3()
		const up = new THREE.Vector3(0, 1, 0)
		function stepFreeFly(dt: number) {
			const keys = input.keys
			const speed = keys.has('ShiftLeft') ? 6 : keys.has('ControlLeft') ? 0.25 : 1.5
			const f = new THREE.Vector3(
				Math.sin(flyYaw) * Math.cos(flyPitch),
				Math.sin(flyPitch),
				Math.cos(flyYaw) * Math.cos(flyPitch)
			)
			const r = new THREE.Vector3().crossVectors(f, up).normalize()
			const want = new THREE.Vector3()
			if (keys.has('KeyW')) want.add(f)
			if (keys.has('KeyS')) want.sub(f)
			if (keys.has('KeyD')) want.add(r)
			if (keys.has('KeyA')) want.sub(r)
			if (keys.has('KeyE')) want.y += 1
			if (keys.has('KeyQ')) want.y -= 1
			want.multiplyScalar(speed)
			flyVel.lerp(want, 1 - Math.exp(-dt * 6))
			camera.position.addScaledVector(flyVel, dt)
			camera.lookAt(camera.position.clone().add(f))
		}
		if (opts.debug) {
			const onKey = (e: KeyboardEvent) => {
				if (e.code !== 'Space') return
				e.preventDefault()
				freeFly = !freeFly
				const d = camera.getWorldDirection(new THREE.Vector3())
				flyYaw = Math.atan2(d.x, d.z)
				flyPitch = Math.asin(d.y)
				flyVel.set(0, 0, 0)
			}
			const onLook = (e: PointerEvent) => {
				if (!freeFly || !input.dragging) return
				flyYaw -= e.movementX * 0.003
				flyPitch = Math.max(-1.5, Math.min(1.5, flyPitch - e.movementY * 0.003))
			}
			addEventListener('keydown', onKey)
			canvas.addEventListener('pointermove', onLook)
			cleanups.push(() => {
				removeEventListener('keydown', onKey)
				canvas.removeEventListener('pointermove', onLook)
			})

			const { GUI } = await import('three/addons/libs/lil-gui.module.min.js')
			const gui = new GUI({ title: 'Water', container: opts.guiContainer })
			gui.close()
			cleanups.push(() => gui.destroy())
			const rebuild = () => ocean.rebuildSpectrum()
			const forceResize = () => {
				W = 0
				resize(cssW, cssH)
			}
			const g1 = gui.addFolder('Ocean')
			g1.add(params, 'windSpeed', 1, 15, 0.1).onFinishChange(rebuild)
			g1.add(params, 'fetch', 1, 300, 1).name('fetch km').onFinishChange(rebuild)
			g1.add(params, 'windDir', 0, 360, 1).onFinishChange(rebuild)
			g1.add(params, 'swellHeight', 0, 2, 0.01).onFinishChange(rebuild)
			g1.add(params, 'swellLength', 10, 200, 1).onFinishChange(rebuild)
			g1.add(params, 'choppiness', 0, 1.6, 0.01)
			g1.add(params, 'foamStrength', 0, 2, 0.01)
			const g2 = gui.addFolder('Water optics')
			;['R', 'G', 'B'].forEach((c, i) => g2.add(params.sigmaA, i, 0, 1, 0.005).name('absorb ' + c))
			;['R', 'G', 'B'].forEach((c, i) =>
				g2.add(params.sigmaS, i, 0, 0.5, 0.005).name('scatter ' + c)
			)
			g2.add(params, 'msBoost', 0, 6, 0.1)
			g2.add(params, 'causticStrength', 0, 2, 0.01)
			g2.add(params, 'causticDepth', 0.5, 10, 0.1)
			g2.add(params, 'causticBlur', 0, 2, 0.01)
			g2.add(params, 'godrays', 0, 1, 0.01)
			g2.add(params, 'godraySteps', 0, 96, 1)
			gui.add(params, 'quality', Object.keys(QUALITY)).onChange((q: string) => {
				Object.assign(params, QUALITY[q as keyof typeof QUALITY])
				gui.controllersRecursive().forEach((c: { updateDisplay(): void }) => c.updateDisplay())
				forceResize()
			})
			const g4 = gui.addFolder('Camera')
			g4.add(params, 'autoExposure')
			g4.add(params, 'exposure', 0.05, 8, 0.01)
			g4.add(params, 'exposureKey', 0.02, 0.6, 0.01)
			g4.add(params, 'bloom', 0, 0.2, 0.001)
			g4.add(params, 'renderScale', 0.5, 2, 0.05).onFinishChange(forceResize)
			g4.add(params, 'fov', 20, 100, 1).onChange((v: number) => {
				camera.fov = v
				camera.updateProjectionMatrix()
			})
		}

		// ------------------------------------------------------------ frame
		let time = 0
		const submergedAt = (u: number, v: number) => {
			// WebGPU clip z: 0 = near plane
			const p = new THREE.Vector3(u * 2 - 1, 1 - v * 2, 0).unproject(camera)
			return p.y < ocean.heightAt(p.x, p.z)
		}

		function frame(dt: number) {
			time += dt

			if (freeFly) stepFreeFly(dt)
			else {
				// ocean.heightAt comes from an async readback (1-2 frames late, 0 until the first one arrives):
				// fine for game logic, never used for rendering
				const env = {
					floor: terrainHeight(sub.x, sub.z),
					surface: ocean.heightAt(sub.x, sub.z),
				}
				sub = stepSub(sub, inputFromKeys(input.keys), env, dt)
				cam = stepChase(cam, chaseTarget(sub, input.orbit), terrainHeight, dt)
				camera.position.set(cam.x, cam.y, cam.z)
				camera.lookAt(sub.x, sub.y + CHASE.lookAhead, sub.z)
			}
			subMesh.position.set(sub.x, sub.y, sub.z)
			subMesh.rotation.y = sub.yaw
			camera.updateMatrixWorld()

			// the sun follows the camera for a tight shadow frustum
			sunLight.color.copy(sun.color).multiplyScalar(params.sunScale)
			sunLight.intensity = 1
			const fwd = camera.getWorldDirection(new THREE.Vector3())
			const focus = camera.position.clone().addScaledVector(fwd, 25)
			sunLight.target.position.copy(focus)
			sunLight.position.copy(focus).addScaledVector(sun.dir, 150)
			sunLight.target.updateMatrixWorld()

			const sunState = { dir: sun.dir, color: sunLight.color, ambient: sun.ambient }
			updateOceanUniforms(O, params, sunState)
			O.U.camXZ.value.set(camera.position.x, camera.position.z)
			O.U.camFwd.value.copy(fwd)
			O.U.time.value = time
			const water = waters[style]
			water.uniforms.roughness.value = params.waterRoughness
			water.uniforms.sss.value = params.sss
			water.uniforms.refractStrength.value = params.refractStrength
			particles.update(camera, time)

			// 1) ocean compute + caustics, lens state, per-pixel near-plane wave test
			let enc = device.createCommandEncoder({ label: 'ocean' })
			ocean.update(dt, enc, camera.position, sun.dir)
			post.updateDown(camera)
			const dropCount = drops.update(dt, submergedAt, post.down, cssW / Math.max(cssH, 1), params)
			post.setDrops(drops.buf, dropCount)
			post.prepare(enc, camera, params, sunState, O.U, dt, time)
			device.queue.submit([enc.finish()])
			ocean.afterSubmit()
			O.U.causticOrigin.value.set(...(ocean.caustics.origin as [number, number]))

			// 2) opaque scene into the HDR target
			const target = rt!
			renderer.setRenderTarget(target)
			renderer.render(scene, camera)
			if (target.needsPostBind) {
				post.bindScene(
					backend.get(target.texture).texture,
					backend.get(target.depthTexture).texture
				)
				target.needsPostBind = false
			}
			// 3) water surface
			renderer.autoClear = false
			for (const waterScene of waterScenes) {
				enc = device.createCommandEncoder({ label: 'backdrop' })
				post.copyBackdrop(enc, camera)
				device.queue.submit([enc.finish()])
				renderer.render(waterScene, camera)
			}
			renderer.autoClear = true

			// 4) post stack -> canvas
			enc = device.createCommandEncoder({ label: 'post' })
			post.render(enc, ctx.getCurrentTexture().createView())
			device.queue.submit([enc.finish()])
		}

		// warm-up: compile the pipelines of both styles before the first visible frame, so switching never stalls
		showStyle(otherStyle(opts.style))
		frame(1 / 60)
		showStyle(opts.style)
		frame(1 / 60)
		setStyle = showStyle
		await device.queue.onSubmittedWorkDone()
		opts.onStatus('')

		let last = performance.now()
		const fpsMeter = createFpsMeter(500)
		let statusAt = 0
		let raf = 0
		function loop(now: number) {
			if (disposed) return
			raf = requestAnimationFrame(loop)
			const dt = clampDt(last, now)
			last = now
			frame(dt)
			const reading = fpsMeter.tick(now)
			if (reading) opts.onFps?.(reading)
			if (opts.debug) {
				if (now - statusAt > 500) {
					statusAt = now
					const depth = camera.position.y - ocean.heightAt(camera.position.x, camera.position.z)
					opts.onStatus(
						`${W}×${H} · Hs ${(ocean.hs ?? 0).toFixed(2)} m · camera ${depth >= 0 ? '+' : ''}${depth.toFixed(2)} m · ${freeFly ? 'free fly (Space = submarine)' : 'submarine (Space = free fly)'}`
					)
				}
			}
		}
		raf = requestAnimationFrame((t) => {
			last = t
			loop(t)
		})
		cleanups.push(() => cancelAnimationFrame(raf))
	} catch (error) {
		dispose()
		throw error
	}

	return { setStyle: (style) => !disposed && setStyle(style), dispose }
}
