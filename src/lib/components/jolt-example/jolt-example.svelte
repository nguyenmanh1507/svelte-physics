<script lang="ts">
	import Jolt from 'jolt-physics'
	import * as THREE from 'three'
	import { OrbitControls } from 'three/examples/jsm/Addons.js'
	import { onMount } from 'svelte'

	import { getRandomQuat } from '$lib/utils/jolt-utils'
	import { Stats } from '$lib/components/stats'

	let canvas: HTMLCanvasElement | undefined
	let container: HTMLDivElement | undefined

	// Object layers
	const LAYER_NON_MOVING = 0
	const LAYER_MOVING = 1
	const NUM_OBJECT_LAYERS = 2

	let jolt: Jolt.JoltInterface
	let physicsSystem: Jolt.PhysicsSystem
	let bodyInterface: Jolt.BodyInterface
	let settings: Jolt.JoltSettings

	function initPhysics() {
		// Initialize Jolt
		settings = new Jolt.JoltSettings()

		// Limit the number of worker threads to 3 (for a total of 4 threads working on the simulation). Note that this value will always be clamped against the number of CPUs in the system - 1.
		settings.mMaxWorkerThreads = 3

		// setupCollisionFiltering(settings);
		jolt = new Jolt.JoltInterface(settings)
		Jolt.destroy(settings)
		physicsSystem = jolt.GetPhysicsSystem()
		bodyInterface = physicsSystem.GetBodyInterface()
	}

	let renderer: THREE.WebGLRenderer
	let camera: THREE.PerspectiveCamera
	let scene: THREE.Scene
	let controls: OrbitControls

	function onWindowResize() {
		if (!container) return

		camera.aspect = container.clientWidth / container.clientHeight
		camera.updateProjectionMatrix()

		renderer.setSize(container.clientWidth, container.clientHeight)
	}

	function initGraphics() {
		if (!canvas) return

		renderer = new THREE.WebGLRenderer({
			canvas,
			antialias: true,
		})
		renderer.setClearColor(0xbfd1e5)
		renderer.setPixelRatio(window.devicePixelRatio)
		renderer.setSize(canvas.clientWidth, canvas.clientHeight)

		camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.2, 2000)
		camera.position.set(0, 15, 30)
		camera.lookAt(new THREE.Vector3(0, 0, 0))

		scene = new THREE.Scene()

		const dirLight = new THREE.DirectionalLight(0xffffff, 1)
		dirLight.position.set(10, 10, 5)
		scene.add(dirLight)

		controls = new OrbitControls(camera, renderer.domElement)

		window.addEventListener('resize', onWindowResize)
	}

	function render() {
		requestAnimationFrame(render)

		renderer.render(scene, camera)
	}

	function getThreeObjectForBody(body: Jolt.Body, color: number): THREE.Object3D {
		return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color }))
	}

	function addToThreeScene(body: Jolt.Body, color: number) {
		const threeObject = getThreeObjectForBody(body, color)
		threeObject.userData.body = body
	}

	function addToScene(body: Jolt.Body, color: number) {
		bodyInterface.AddBody(body.GetID(), Jolt.EActivation_Activate)

		addToThreeScene(body, color)
	}

	function generateObjects() {
		const numTypes = 10
		const objectType = Math.ceil(Math.random() * numTypes)
		let shape = null
		const colors = [
			0xff0000, 0xd9b1a3, 0x4d4139, 0xccad33, 0xf2ff40, 0x00ff00, 0x165943, 0x567371, 0x80d5ff,
			0x69778c, 0xbeb6f2, 0x7159b3, 0x73004d, 0xd90074, 0xff8091, 0xbf3030, 0x592400, 0xa66c29,
			0xb3aa86, 0x296600, 0x00e600, 0x66ccaa, 0x00eeff, 0x3d9df2, 0x000e33, 0x3d00e6, 0xb300a7,
			0xff80d5, 0x330d17, 0x59332d, 0xff8c40, 0x33210d, 0x403c00, 0x89d96c, 0x0d3312, 0x0d3330,
			0x005c73, 0x0066ff, 0x334166, 0x1b0066, 0x4d3949, 0xbf8faf, 0x59000c, 0x0000ff,
		]

		switch (objectType) {
			case 1: {
				// Sphere
				const radius = 0.5 + Math.random()
				shape = new Jolt.SphereShape(radius)
				break
			}

			case 2: {
				// Box
				const sx = 1 + Math.random()
				const sy = 1 + Math.random()
				const sz = 1 + Math.random()
				shape = new Jolt.BoxShape(new Jolt.Vec3(sx * 0.5, sy * 0.5, sz * 0.5), 0.5)
				break
			}

			case 3: {
				// Cylinder
				const radius = 0.5 + Math.random()
				const halfHeight = 0.5 + 0.5 * Math.random()
				shape = new Jolt.CylinderShape(halfHeight, radius, 0.05)
				break
			}

			case 4: {
				// Tapered cylinder
				const topRadius = 0.1 + Math.random()
				const bottomRadius = 0.5 + Math.random()
				const halfHeight = 0.5 * (topRadius + bottomRadius + Math.random())
				shape = new Jolt.TaperedCylinderShapeSettings(halfHeight, topRadius, bottomRadius)
					.Create()
					.Get()
				break
			}

			case 5: {
				// Capsule
				const radius = 0.5 + Math.random()
				const halfHeight = 0.5 + 0.5 * Math.random()
				shape = new Jolt.CapsuleShape(halfHeight, radius)
				break
			}

			case 6: {
				// Tapered capsule
				const topRadius = 0.1 + Math.random()
				const bottomRadius = 0.5 + Math.random()
				const halfHeight = 0.5 * (topRadius + bottomRadius + Math.random())
				shape = new Jolt.TaperedCapsuleShapeSettings(halfHeight, topRadius, bottomRadius)
					.Create()
					.Get()
				break
			}

			case 7: {
				// Convex hull
				const hull = new Jolt.ConvexHullShapeSettings()
				for (let p = 0; p < 10; ++p)
					hull.mPoints.push_back(
						new Jolt.Vec3(
							-0.5 + 2 * Math.random(),
							-0.5 + 2 * Math.random(),
							-0.5 + 2 * Math.random()
						)
					)
				shape = hull.Create().Get()
				break
			}

			case 8: {
				// Static compound shape
				const shapeSettings = new Jolt.StaticCompoundShapeSettings()
				const l = 1.0 + Math.random()
				const r2 = 0.5 + 0.5 * Math.random()
				const r1 = 0.5 * r2
				shapeSettings.AddShape(
					new Jolt.Vec3(-l, 0, 0),
					Jolt.Quat.prototype.sIdentity(),
					new Jolt.SphereShapeSettings(r2),
					0
				)
				shapeSettings.AddShape(
					new Jolt.Vec3(l, 0, 0),
					Jolt.Quat.prototype.sIdentity(),
					new Jolt.SphereShapeSettings(r2),
					0
				)
				shapeSettings.AddShape(
					new Jolt.Vec3(0, 0, 0),
					Jolt.Quat.prototype.sRotation(new Jolt.Vec3(0, 0, 1), 0.5 * Math.PI),
					new Jolt.CapsuleShapeSettings(l, r1),
					0
				)
				shape = shapeSettings.Create().Get()
				break
			}

			case 9: {
				// Mutable compound shape
				const shapeSettings = new Jolt.MutableCompoundShapeSettings()
				const l = 1.0 + Math.random()
				const r2 = 0.5 + 0.5 * Math.random()
				const r1 = 0.5 * r2
				shapeSettings.AddShape(
					new Jolt.Vec3(-l, 0, 0),
					Jolt.Quat.prototype.sIdentity(),
					new Jolt.SphereShapeSettings(r2),
					0
				)
				shapeSettings.AddShape(
					new Jolt.Vec3(l, 0, 0),
					Jolt.Quat.prototype.sIdentity(),
					new Jolt.BoxShapeSettings(Jolt.Vec3.prototype.sReplicate(r2)),
					0
				)
				shapeSettings.AddShape(
					new Jolt.Vec3(0, 0, 0),
					Jolt.Quat.prototype.sRotation(new Jolt.Vec3(0, 0, 1), 0.5 * Math.PI),
					new Jolt.CapsuleShapeSettings(l, r1),
					0
				)
				shape = shapeSettings.Create().Get()
				break
			}

			case 10: {
				// Sphere with COM offset
				const radius = 0.5
				shape = new Jolt.OffsetCenterOfMassShapeSettings(
					new Jolt.Vec3(0, -0.1 * radius, 0),
					new Jolt.SphereShapeSettings(radius)
				)
					.Create()
					.Get()
				break
			}
		}

		// Position and rotate body
		const pos = new Jolt.RVec3((Math.random() - 0.5) * 25, 15, (Math.random() - 0.5) * 25)
		const rot = getRandomQuat()

		if (!shape) {
			throw new Error('Shape is null')
		}

		// Create physics body
		const creationSettings = new Jolt.BodyCreationSettings(
			shape,
			pos,
			rot,
			Jolt.EMotionType_Dynamic,
			LAYER_MOVING
		)
		creationSettings.mRestitution = 0.5
		let body = bodyInterface.CreateBody(creationSettings)
		addToScene(body, colors[objectType - 1])
	}

	onMount(() => {
		initGraphics()
		initPhysics()
		render()

		return () => {
			window.removeEventListener('resize', onWindowResize)
		}
	})
</script>

<div>
	<h1>Jolt Physics Example</h1>

	<div bind:this={container}>
		<canvas bind:this={canvas} class="w-full rounded border"></canvas>
	</div>
</div>

<Stats />
