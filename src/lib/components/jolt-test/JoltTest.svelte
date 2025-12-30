<script lang="ts">
	import initJolt from 'jolt-physics'
	import type JoltType from 'jolt-physics'
	import * as THREE from 'three'
	import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
	import { onMount } from 'svelte'

	let container: HTMLDivElement

	// Jolt module (initialized async)
	let Jolt: typeof JoltType

	// Physics objects
	let joltInterface: JoltType.JoltInterface
	let physicsSystem: JoltType.PhysicsSystem
	let bodyInterface: JoltType.BodyInterface

	// Three.js objects
	let renderer: THREE.WebGLRenderer
	let camera: THREE.PerspectiveCamera
	let scene: THREE.Scene
	let controls: OrbitControls

	// Track bodies and their visual meshes
	const dynamicBodies: Array<{ body: JoltType.Body; mesh: THREE.Mesh }> = []

	// Object layers for collision filtering
	const LAYER_NON_MOVING = 0
	const LAYER_MOVING = 1

	/**
	 * Initialize the Jolt Physics engine
	 */
	async function initPhysics(): Promise<void> {
		// Load WASM module
		Jolt = await initJolt()

		// Create settings with collision filtering
		const settings = new Jolt.JoltSettings()

		// Set up object layer pair filter (which layers can collide with each other)
		const objectFilter = new Jolt.ObjectLayerPairFilterTable(2)
		objectFilter.EnableCollision(LAYER_NON_MOVING, LAYER_MOVING)
		objectFilter.EnableCollision(LAYER_MOVING, LAYER_MOVING)

		// Set up broad phase layer interface
		const BP_LAYER_NON_MOVING = new Jolt.BroadPhaseLayer(0)
		const BP_LAYER_MOVING = new Jolt.BroadPhaseLayer(1)
		const bpInterface = new Jolt.BroadPhaseLayerInterfaceTable(2, 2)
		bpInterface.MapObjectToBroadPhaseLayer(LAYER_NON_MOVING, BP_LAYER_NON_MOVING)
		bpInterface.MapObjectToBroadPhaseLayer(LAYER_MOVING, BP_LAYER_MOVING)

		// Set up object vs broad phase layer filter
		const objectVsBroadphaseFilter = new Jolt.ObjectVsBroadPhaseLayerFilterTable(
			bpInterface,
			2,
			objectFilter,
			2
		)

		// Apply filters to settings
		settings.mObjectLayerPairFilter = objectFilter
		settings.mBroadPhaseLayerInterface = bpInterface
		settings.mObjectVsBroadPhaseLayerFilter = objectVsBroadphaseFilter

		// Create the physics interface
		joltInterface = new Jolt.JoltInterface(settings)
		physicsSystem = joltInterface.GetPhysicsSystem()
		bodyInterface = physicsSystem.GetBodyInterface()

		// Clean up settings
		Jolt.destroy(settings)
	}

	/**
	 * Initialize Three.js renderer and scene
	 */
	function initGraphics(): void {
		// Create renderer
		renderer = new THREE.WebGLRenderer({ antialias: true })
		renderer.setPixelRatio(window.devicePixelRatio)
		renderer.setSize(container.clientWidth, container.clientHeight)
		renderer.setClearColor(0x1a1a2e)
		renderer.shadowMap.enabled = true
		container.appendChild(renderer.domElement)

		// Create camera
		camera = new THREE.PerspectiveCamera(
			60,
			container.clientWidth / container.clientHeight,
			0.1,
			1000
		)
		camera.position.set(15, 15, 15)
		camera.lookAt(0, 0, 0)

		// Create scene
		scene = new THREE.Scene()

		// Add lights
		const ambientLight = new THREE.AmbientLight(0x404040, 0.5)
		scene.add(ambientLight)

		const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
		directionalLight.position.set(10, 20, 10)
		directionalLight.castShadow = true
		directionalLight.shadow.mapSize.width = 2048
		directionalLight.shadow.mapSize.height = 2048
		scene.add(directionalLight)

		// Add orbit controls
		controls = new OrbitControls(camera, renderer.domElement)
		controls.enableDamping = true

		// Handle resize
		window.addEventListener('resize', onResize)
	}

	/**
	 * Create a static ground plane
	 */
	function createGround(): void {
		// Physics: Create a large box for the ground
		const groundShape = new Jolt.BoxShape(new Jolt.Vec3(50, 0.5, 50))
		const groundSettings = new Jolt.BodyCreationSettings(
			groundShape,
			new Jolt.RVec3(0, -0.5, 0),
			new Jolt.Quat(0, 0, 0, 1),
			Jolt.EMotionType_Static,
			LAYER_NON_MOVING
		)
		const groundBody = bodyInterface.CreateBody(groundSettings)
		bodyInterface.AddBody(groundBody.GetID(), Jolt.EActivation_DontActivate)

		// Visual: Create ground mesh
		const groundGeometry = new THREE.BoxGeometry(100, 1, 100)
		const groundMaterial = new THREE.MeshStandardMaterial({
			color: 0x2d4a3e,
			roughness: 0.8,
		})
		const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial)
		groundMesh.position.set(0, -0.5, 0)
		groundMesh.receiveShadow = true
		scene.add(groundMesh)

		// Clean up
		Jolt.destroy(groundSettings)
	}

	/**
	 * Create a dynamic falling sphere
	 */
	function createSphere(x: number, y: number, z: number, radius: number, color: number): void {
		// Physics body
		const sphereShape = new Jolt.SphereShape(radius)
		const sphereSettings = new Jolt.BodyCreationSettings(
			sphereShape,
			new Jolt.RVec3(x, y, z),
			new Jolt.Quat(0, 0, 0, 1),
			Jolt.EMotionType_Dynamic,
			LAYER_MOVING
		)
		sphereSettings.mRestitution = 0.5
		const sphereBody = bodyInterface.CreateBody(sphereSettings)
		bodyInterface.AddBody(sphereBody.GetID(), Jolt.EActivation_Activate)

		// Visual mesh
		const sphereGeometry = new THREE.SphereGeometry(radius, 32, 32)
		const sphereMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.4 })
		const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial)
		sphereMesh.castShadow = true
		scene.add(sphereMesh)

		// Track for sync
		dynamicBodies.push({ body: sphereBody, mesh: sphereMesh })

		// Clean up
		Jolt.destroy(sphereSettings)
	}

	/**
	 * Create a dynamic falling box
	 */
	function createBox(x: number, y: number, z: number, size: number, color: number): void {
		const halfSize = size / 2

		// Physics body
		const boxShape = new Jolt.BoxShape(new Jolt.Vec3(halfSize, halfSize, halfSize))
		const boxSettings = new Jolt.BodyCreationSettings(
			boxShape,
			new Jolt.RVec3(x, y, z),
			new Jolt.Quat(0, 0, 0, 1),
			Jolt.EMotionType_Dynamic,
			LAYER_MOVING
		)
		boxSettings.mRestitution = 0.3
		const boxBody = bodyInterface.CreateBody(boxSettings)
		bodyInterface.AddBody(boxBody.GetID(), Jolt.EActivation_Activate)

		// Visual mesh
		const boxGeometry = new THREE.BoxGeometry(size, size, size)
		const boxMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.4 })
		const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial)
		boxMesh.castShadow = true
		scene.add(boxMesh)

		// Track for sync
		dynamicBodies.push({ body: boxBody, mesh: boxMesh })

		// Clean up
		Jolt.destroy(boxSettings)
	}

	/**
	 * Sync Three.js meshes with physics bodies
	 */
	function syncBodies(): void {
		for (const { body, mesh } of dynamicBodies) {
			const position = body.GetPosition()
			const rotation = body.GetRotation()

			mesh.position.set(position.GetX(), position.GetY(), position.GetZ())
			mesh.quaternion.set(rotation.GetX(), rotation.GetY(), rotation.GetZ(), rotation.GetW())
		}
	}

	/**
	 * Animation loop
	 */
	function animate(): void {
		requestAnimationFrame(animate)

		// Step physics (1/60 second, 1 collision step)
		joltInterface.Step(1 / 60, 1)

		// Sync physics to visuals
		syncBodies()

		// Update controls
		controls.update()

		// Render
		renderer.render(scene, camera)
	}

	/**
	 * Handle window resize
	 */
	function onResize(): void {
		camera.aspect = container.clientWidth / container.clientHeight
		camera.updateProjectionMatrix()
		renderer.setSize(container.clientWidth, container.clientHeight)
	}

	/**
	 * Spawn a random object
	 */
	function spawnObject(): void {
		const x = (Math.random() - 0.5) * 10
		const y = 10 + Math.random() * 5
		const z = (Math.random() - 0.5) * 10
		const colors = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c]
		const color = colors[Math.floor(Math.random() * colors.length)]

		if (Math.random() > 0.5) {
			createSphere(x, y, z, 0.5 + Math.random() * 0.5, color)
		} else {
			createBox(x, y, z, 0.8 + Math.random() * 0.6, color)
		}
	}

	onMount(() => {
		initGraphics()

		// Initialize physics and start simulation
		initPhysics().then(() => {
			createGround()

			// Create some initial objects
			for (let i = 0; i < 5; i++) {
				spawnObject()
			}

			// Start animation loop
			animate()
		})

		return () => {
			window.removeEventListener('resize', onResize)
			renderer.dispose()
		}
	})
</script>

<div class="flex flex-col gap-4">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">Jolt Physics + Three.js</h1>
		<button
			onclick={spawnObject}
			class="rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
		>
			Drop Object
		</button>
	</div>

	<div
		bind:this={container}
		class="h-[600px] w-full overflow-hidden rounded-lg border border-gray-700"
	></div>

	<p class="text-sm text-gray-400">
		Click "Drop Object" to spawn falling spheres and boxes. Use mouse to orbit the camera.
	</p>
</div>
