<script lang="ts">
	import * as THREE from 'three'
	import { OrbitControls } from 'three/examples/jsm/Addons.js'
	import { onMount } from 'svelte'
	import initJolt from 'jolt-physics'
	import type JoltType from 'jolt-physics'

	import { getRandomQuat } from '$lib/utils/jolt-utils'
	import { Stats } from '$lib/components/stats'

	let canvas: HTMLCanvasElement | undefined
	let container: HTMLDivElement | undefined

	const clock = new THREE.Clock()
	let time = 0

	// Object layers
	const LAYER_NON_MOVING = 0
	const LAYER_MOVING = 1
	const NUM_OBJECT_LAYERS = 2

	const dynamicObjects: THREE.Object3D[] = []

	const wrapVec3 = (v: JoltType.RVec3 | JoltType.Vec3) =>
		new THREE.Vector3(v.GetX(), v.GetY(), v.GetZ())
	const wrapQuat = (q: JoltType.Quat) =>
		new THREE.Quaternion(q.GetX(), q.GetY(), q.GetZ(), q.GetW())

	// let Jolt: typeof JoltType
	let jolt: JoltType.JoltInterface
	let physicsSystem: JoltType.PhysicsSystem
	let bodyInterface: JoltType.BodyInterface
	let settings: JoltType.JoltSettings

	function setupCollisionFiltering(settings: JoltType.JoltSettings) {
		if (!Jolt) return

		// Layer that objects can be in, determines which other objects it can collide with
		// Typically you at least want to have 1 layer for moving bodies and 1 layer for static bodies, but you can have more
		// layers if you want. E.g. you could have a layer for high detail collision (which is not used by the physics simulation
		// but only if you do collision testing).
		let objectFilter = new Jolt.ObjectLayerPairFilterTable(NUM_OBJECT_LAYERS)
		objectFilter.EnableCollision(LAYER_NON_MOVING, LAYER_MOVING)
		objectFilter.EnableCollision(LAYER_MOVING, LAYER_MOVING)

		// Each broadphase layer results in a separate bounding volume tree in the broad phase. You at least want to have
		// a layer for non-moving and moving objects to avoid having to update a tree full of static objects every frame.
		// You can have a 1-on-1 mapping between object layers and broadphase layers (like in this case) but if you have
		// many object layers you'll be creating many broad phase trees, which is not efficient.
		const BP_LAYER_NON_MOVING = new Jolt.BroadPhaseLayer(0)
		const BP_LAYER_MOVING = new Jolt.BroadPhaseLayer(1)
		const NUM_BROAD_PHASE_LAYERS = 2
		let bpInterface = new Jolt.BroadPhaseLayerInterfaceTable(
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

	async function initPhysics(Jolt: typeof JoltType) {
		// Load WASM module
		// Jolt = await initJolt()

		window.Jolt = Jolt

		// Initialize Jolt
		settings = new Jolt.JoltSettings()

		// Limit the number of worker threads to 3 (for a total of 4 threads working on the simulation). Note that this value will always be clamped against the number of CPUs in the system - 1.
		settings.mMaxWorkerThreads = 3

		setupCollisionFiltering(settings)
		jolt = new Jolt.JoltInterface(settings)
		Jolt.destroy(settings)
		physicsSystem = jolt.GetPhysicsSystem()
		bodyInterface = physicsSystem.GetBodyInterface()
	}

	function updatePhysics(deltaTime: number) {
		if (!jolt) return

		// When running below 55 Hz, do 2 steps instead of 1
		const numSteps = deltaTime < 1.0 / 55.0 ? 2 : 1

		// Step the physics world
		jolt.Step(deltaTime, numSteps)
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

		// Don't go below 30 Hz to prevent spiral of death
		let deltaTime = clock.getDelta()
		deltaTime = Math.min(deltaTime, 1.0 / 30.0)

		// onExampleUpdate(time, deltaTime)

		time += deltaTime

		updatePhysics(deltaTime)

		renderer.render(scene, camera)
	}

	function getSoftBodyMesh(body: JoltType.Body, material: THREE.Material): THREE.Object3D {
		if (!Jolt) return new THREE.Object3D()

		const motionProperties = Jolt.castObject(
			body.GetMotionProperties(),
			Jolt.SoftBodyMotionProperties
		)
		const vertexSettings = motionProperties.GetVertices()
		const settings = motionProperties.GetSettings()
		const positionOffset = Jolt.SoftBodyVertexTraits.prototype.mPositionOffset
		const faceData = settings.mFaces

		// Get a view on the triangle data
		const softVertex: Float32Array[] = []
		for (let i = 0; i < vertexSettings.size(); i++) {
			softVertex.push(
				new Float32Array(
					Jolt.HEAP32.buffer,
					Jolt.getPointer(vertexSettings.at(i)) + positionOffset,
					3
				)
			)
		}

		// Define faces (indices of vertices for the triangles)
		const faces = new Uint32Array(faceData.size() * 3)
		for (let i = 0; i < faceData.size(); i++) {
			faces.set(new Uint32Array(Jolt.HEAP32.buffer, Jolt.getPointer(faceData.at(i)), 3), i * 3)
		}

		// Create a three mesh
		let geometry = new THREE.BufferGeometry()
		let vertices = new Float32Array(vertexSettings.size() * 3)
		geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
		geometry.setIndex(new THREE.BufferAttribute(faces, 1))
		material.side = THREE.DoubleSide
		const threeObject = new THREE.Mesh(geometry, material)
		threeObject.userData.updateVertex = () => {
			for (let i = 0; i < softVertex.length; i++) {
				vertices.set(softVertex[i], i * 3)
			}
			geometry.computeVertexNormals()
			geometry.getAttribute('position').needsUpdate = true
			geometry.getAttribute('normal').needsUpdate = true
		}
		threeObject.userData.updateVertex()
		return threeObject
	}

	function createMeshForShape(shape: JoltType.Shape): THREE.BufferGeometry {
		if (!Jolt) return new THREE.BufferGeometry()

		// Get triangle data
		let scale = new Jolt.Vec3(1, 1, 1)
		let triContext = new Jolt.ShapeGetTriangles(
			shape,
			Jolt.AABox.prototype.sBiggest(),
			shape.GetCenterOfMass(),
			Jolt.Quat.prototype.sIdentity(),
			scale
		)
		Jolt.destroy(scale)

		// Get a view on the triangle data (does not make a copy)
		let vertices = new Float32Array(
			Jolt.HEAPF32.buffer,
			triContext.GetVerticesData(),
			triContext.GetVerticesSize() / Float32Array.BYTES_PER_ELEMENT
		)

		// Now move the triangle data to a buffer and clone it so that we can free the memory from the C++ heap (which could be limited in size)
		let buffer = new THREE.BufferAttribute(vertices, 3).clone()
		Jolt.destroy(triContext)

		// Create a three mesh
		let geometry = new THREE.BufferGeometry()
		geometry.setAttribute('position', buffer)
		geometry.computeVertexNormals()

		return geometry
	}

	function getThreeObjectForBody(body: JoltType.Body, color: number): THREE.Object3D {
		if (!Jolt) return new THREE.Object3D()

		const material = new THREE.MeshPhongMaterial({ color })
		let threeObject: THREE.Object3D
		const shape = body.GetShape()
		switch (shape.GetSubType()) {
			case Jolt.EShapeSubType_Box:
				let boxShape = Jolt.castObject(shape, Jolt.BoxShape)
				let extent = wrapVec3(boxShape.GetHalfExtent()).multiplyScalar(2)
				threeObject = new THREE.Mesh(
					new THREE.BoxGeometry(extent.x, extent.y, extent.z, 1, 1, 1),
					material
				)
				break
			case Jolt.EShapeSubType_Sphere:
				let sphereShape = Jolt.castObject(shape, Jolt.SphereShape)
				threeObject = new THREE.Mesh(
					new THREE.SphereGeometry(sphereShape.GetRadius(), 32, 32),
					material
				)
				break
			case Jolt.EShapeSubType_Capsule:
				let capsuleShape = Jolt.castObject(shape, Jolt.CapsuleShape)
				threeObject = new THREE.Mesh(
					new THREE.CapsuleGeometry(
						capsuleShape.GetRadius(),
						2 * capsuleShape.GetHalfHeightOfCylinder(),
						20,
						10
					),
					material
				)
				break
			case Jolt.EShapeSubType_Cylinder:
				let cylinderShape = Jolt.castObject(shape, Jolt.CylinderShape)
				threeObject = new THREE.Mesh(
					new THREE.CylinderGeometry(
						cylinderShape.GetRadius(),
						cylinderShape.GetRadius(),
						2 * cylinderShape.GetHalfHeight(),
						20,
						1
					),
					material
				)
				break
			default:
				if (body.GetBodyType() == Jolt.EBodyType_SoftBody)
					threeObject = getSoftBodyMesh(body, material)
				else threeObject = new THREE.Mesh(createMeshForShape(shape), material)
				break
		}

		threeObject.position.copy(wrapVec3(body.GetPosition()))
		threeObject.quaternion.copy(wrapQuat(body.GetRotation()))

		return threeObject
	}

	function addToThreeScene(body: JoltType.Body, color: number) {
		const threeObject = getThreeObjectForBody(body, color)
		threeObject.userData.body = body

		scene.add(threeObject)
		dynamicObjects.push(threeObject)
	}

	function addToScene(body: JoltType.Body, color: number) {
		if (!Jolt) return

		bodyInterface.AddBody(body.GetID(), Jolt.EActivation_Activate)

		addToThreeScene(body, color)
	}

	function generateObjects() {
		if (!Jolt) return

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

	function createFloor(size = 50) {
		if (!Jolt) return

		var shape = new Jolt.BoxShape(new Jolt.Vec3(size, 0.5, size), 0.05)
		var creationSettings = new Jolt.BodyCreationSettings(
			shape,
			new Jolt.RVec3(0, -0.5, 0),
			new Jolt.Quat(0, 0, 0, 1),
			Jolt.EMotionType_Static,
			LAYER_NON_MOVING
		)
		let body = bodyInterface.CreateBody(creationSettings)
		Jolt.destroy(creationSettings)
		addToScene(body, 0xc7c7c7)
		return body
	}

	function createMeshFloor(
		n: number,
		cellSize: number,
		maxHeight: number,
		posX: number,
		posY: number,
		posZ: number
	) {
		if (!Jolt) return

		// Create regular grid of triangles
		let height = function (x: number, y: number) {
			return Math.sin(x / 2) * Math.cos(y / 3)
		}
		let triangles = new Jolt.TriangleList()
		triangles.resize(n * n * 2)
		for (let x = 0; x < n; ++x)
			for (let z = 0; z < n; ++z) {
				let center = (n * cellSize) / 2

				let x1 = cellSize * x - center
				let z1 = cellSize * z - center
				let x2 = x1 + cellSize
				let z2 = z1 + cellSize

				{
					let t = triangles.at((x * n + z) * 2)
					let v1 = t.get_mV(0),
						v2 = t.get_mV(1),
						v3 = t.get_mV(2)

					v1.x = x1
					v1.y = height(x, z)
					v1.z = z1
					v2.x = x1
					v2.y = height(x, z + 1)
					v2.z = z2
					v3.x = x2
					v3.y = height(x + 1, z + 1)
					v3.z = z2
				}

				{
					let t = triangles.at((x * n + z) * 2 + 1)
					let v1 = t.get_mV(0),
						v2 = t.get_mV(1),
						v3 = t.get_mV(2)

					v1.x = x1
					v1.y = height(x, z)
					v1.z = z1
					v2.x = x2
					v2.y = height(x + 1, z + 1)
					v2.z = z2
					v3.x = x2
					v3.y = height(x + 1, z)
					v3.z = z1
				}
			}
		let materials = new Jolt.PhysicsMaterialList()
		let shape = new Jolt.MeshShapeSettings(triangles, materials).Create().Get()
		Jolt.destroy(triangles)
		Jolt.destroy(materials)

		// Create body
		let creationSettings = new Jolt.BodyCreationSettings(
			shape,
			new Jolt.RVec3(posX, posY, posZ),
			new Jolt.Quat(0, 0, 0, 1),
			Jolt.EMotionType_Static,
			LAYER_NON_MOVING
		)
		let body = bodyInterface.CreateBody(creationSettings)
		Jolt.destroy(creationSettings)
		addToScene(body, 0xc7c7c7)
	}

	onMount(() => {
		initJolt().then((Jolt) => {
			// Setup graphics and physics
			initGraphics()
			initPhysics(Jolt)
			render()

			createFloor()
			createMeshFloor(30, 1, 4, 0, 5, 0)
		})

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
