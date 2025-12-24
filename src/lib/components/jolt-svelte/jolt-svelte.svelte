<script lang="ts">
	import * as THREE from 'three'
	import initJolt from 'jolt-physics/wasm-compat'
	import type JoltType from 'jolt-physics/wasm-compat'
	import { onMount } from 'svelte'

	let jolt: JoltType.JoltInterface
	let physicsSystem: JoltType.PhysicsSystem
	let bodyInterface: JoltType.BodyInterface

	let scene: THREE.Scene
	let camera: THREE.PerspectiveCamera
	let renderer: THREE.WebGLRenderer
	const clock = new THREE.Clock()
	const dynamicObjects: THREE.Object3D[] = [] // Track physics objects

	let container: HTMLDivElement | undefined

	// Object layers for collision filtering
	const LAYER_NON_MOVING = 0
	const LAYER_MOVING = 1
	const NUM_OBJECT_LAYERS = 2

	/**
	 * Helper functions to convert Jolt vectors/quaternions to Three.js and vice versa
	 * ================================
	 */

	// Convert Jolt vectors/quaternions to Three.js
	const wrapVec3 = (v: JoltType.RVec3 | JoltType.Vec3) =>
		new THREE.Vector3(v.GetX(), v.GetY(), v.GetZ())
	const wrapQuat = (q: JoltType.Quat) =>
		new THREE.Quaternion(q.GetX(), q.GetY(), q.GetZ(), q.GetW())

	// Convert Three.js to Jolt
	const unwrapVec3 = (v: THREE.Vector3) => new Jolt!.Vec3(v.x, v.y, v.z)
	const unwrapRVec3 = (v: THREE.Vector3) => new Jolt!.RVec3(v.x, v.y, v.z)
	const unwrapQuat = (q: THREE.Quaternion) => new Jolt!.Quat(q.x, q.y, q.z, q.w)
	// ================================

	function setupCollisionFiltering(settings: JoltType.JoltSettings) {
		if (!Jolt) return

		// Define which layers can collide with each other
		const objectFilter = new Jolt.ObjectLayerPairFilterTable(NUM_OBJECT_LAYERS)
		objectFilter.EnableCollision(LAYER_NON_MOVING, LAYER_MOVING)
		objectFilter.EnableCollision(LAYER_MOVING, LAYER_MOVING)

		// Map object layers to broadphase layers
		const BP_LAYER_NON_MOVING = new Jolt.BroadPhaseLayer(0)
		const BP_LAYER_MOVING = new Jolt.BroadPhaseLayer(1)
		const NUM_BROAD_PHASE_LAYERS = 2

		const bpInterface = new Jolt.BroadPhaseLayerInterfaceTable(
			NUM_OBJECT_LAYERS,
			NUM_BROAD_PHASE_LAYERS
		)
		bpInterface.MapObjectToBroadPhaseLayer(LAYER_NON_MOVING, BP_LAYER_NON_MOVING)
		bpInterface.MapObjectToBroadPhaseLayer(LAYER_MOVING, BP_LAYER_MOVING)

		settings.mObjectLayerPairFilter = objectFilter
		settings.mBroadPhaseLayerInterface = bpInterface
		settings.mObjectVsBroadPhaseLayerFilter = new Jolt.ObjectVsBroadPhaseLayerFilterTable(
			settings.mBroadPhaseLayerInterface,
			NUM_BROAD_PHASE_LAYERS,
			settings.mObjectLayerPairFilter,
			NUM_OBJECT_LAYERS
		)
	}

	function initPhysics(Jolt: typeof JoltType) {
		window.Jolt = Jolt // Store Jolt in window for global access

		// Create settings
		const settings = new Jolt.JoltSettings()

		// Setup collision filtering (required)
		setupCollisionFiltering(settings)

		// Create the Jolt interface
		jolt = new Jolt.JoltInterface(settings)
		Jolt.destroy(settings)

		// Get references to main systems
		physicsSystem = jolt.GetPhysicsSystem()
		bodyInterface = physicsSystem.GetBodyInterface()
	}

	function initGraphics() {
		if (!container) return

		// Renderer
		renderer = new THREE.WebGLRenderer({ antialias: true })
		renderer.setPixelRatio(window.devicePixelRatio)
		renderer.setSize(container.clientWidth, container.clientHeight)
		renderer.setClearColor(0x1a1a2e)
		renderer.shadowMap.enabled = true
		container.appendChild(renderer.domElement)

		// Camera
		camera = new THREE.PerspectiveCamera(
			60,
			container.clientWidth / container.clientHeight,
			0.2,
			1000
		)
		camera.position.set(0, 15, 30)
		camera.lookAt(0, 0, 0)

		// Scene
		scene = new THREE.Scene()

		// Lighting
		const light = new THREE.DirectionalLight(0xffffff, 1)
		light.position.set(10, 10, 5)
		scene.add(light)

		addEventListener('resize', onResize)
	}

	function onResize() {
		if (!container) return
		camera.aspect = container.clientWidth / container.clientHeight
		camera.updateProjectionMatrix()
		renderer.setSize(container.clientWidth, container.clientHeight)
	}

	function createFloor(size = 50) {
		if (!Jolt) return

		// Physics shape
		const shape = new Jolt.BoxShape(new Jolt.Vec3(size, 0.5, size), 0.05)

		// Physics body settings
		const creationSettings = new Jolt.BodyCreationSettings(
			shape,
			new Jolt.RVec3(0, -0.5, 0),
			new Jolt.Quat(0, 0, 0, 1),
			Jolt.EMotionType_Static,
			LAYER_NON_MOVING
		)
		const body = bodyInterface.CreateBody(creationSettings)
		Jolt.destroy(creationSettings)

		// Add to physics world
		bodyInterface.AddBody(body.GetID(), Jolt.EActivation_Activate)

		// Create corresponding Three.js mesh
		const geometry = new THREE.BoxGeometry(size * 2, 1, size * 2)
		const material = new THREE.MeshPhongMaterial({ color: 0xc7c7c7 })
		const mesh = new THREE.Mesh(geometry, material)
		mesh.position.set(0, -0.5, 0)
		mesh.userData.body = body // IMPORTANT: Link physics body to mesh

		scene.add(mesh)
		dynamicObjects.push(mesh)

		return body
	}

	function createSphere(position: THREE.Vector3, radius: number, color = 0xff0000) {
		if (!Jolt) return

		// Physics shape
		const shape = new Jolt.SphereShape(radius)

		// Physics body
		const creationSettings = new Jolt.BodyCreationSettings(
			shape,
			new Jolt.RVec3(position.x, position.y, position.z),
			Jolt.Quat.prototype.sIdentity(),
			Jolt.EMotionType_Dynamic, // Dynamic body
			LAYER_MOVING
		)
		creationSettings.mRestitution = 0.5 // Bounciness
		const body = bodyInterface.CreateBody(creationSettings)
		Jolt.destroy(creationSettings)

		bodyInterface.AddBody(body.GetID(), Jolt.EActivation_Activate)

		// Three.js mesh
		const geometry = new THREE.SphereGeometry(radius, 32, 32)
		const material = new THREE.MeshPhongMaterial({ color })
		const mesh = new THREE.Mesh(geometry, material)
		mesh.userData.body = body

		scene.add(mesh)
		dynamicObjects.push(mesh)

		return body
	}

	let rafId: number
	function animate() {
		rafId = requestAnimationFrame(animate)

		// Get delta time (clamped to prevent spiral of death)
		let deltaTime = clock.getDelta()
		deltaTime = Math.min(deltaTime, 1.0 / 30.0)

		// Step physics simulation
		// Use 2 sub-steps when framerate drops below 55 Hz
		const numSteps = deltaTime > 1.0 / 55.0 ? 2 : 1
		jolt.Step(deltaTime, numSteps)

		// Sync Three.js meshes with physics bodies
		for (const mesh of dynamicObjects) {
			const body = mesh.userData.body
			if (body) {
				mesh.position.copy(wrapVec3(body.GetPosition()))
				mesh.quaternion.copy(wrapQuat(body.GetRotation()))
			}
		}

		renderer.render(scene, camera)
	}

	onMount(() => {
		initJolt().then((Jolt) => {
			initPhysics(Jolt)
			initGraphics()

			// Create scene objects
			createFloor()

			// Spawn some dynamic spheres

			for (let i = 0; i < 10; i++) {
				const randomPosition = new THREE.Vector3(
					(Math.random() - 0.5) * 10,
					10 + i * 2,
					(Math.random() - 0.5) * 10
				)
				createSphere(randomPosition, 0.5 + Math.random() * 0.5, Math.random() * 0xffffff)
			}

			// Start render loop
			animate()
		})

		return () => {
			removeEventListener('resize', onResize)
			cancelAnimationFrame(rafId)
		}
	})
</script>

<div
	bind:this={container}
	class="h-[600px] w-full overflow-hidden rounded-lg border border-gray-700"
></div>
