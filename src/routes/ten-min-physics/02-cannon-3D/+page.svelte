<script lang="ts">
	import { onMount } from 'svelte'
	import { CodeHighlight } from '~/lib/components/code-highlight'
	import * as THREE from 'three'
	import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

	let containerRef: HTMLDivElement | undefined
	let paused = $state(true)
	let objects = $state<Ball[]>([])

	// Physics scene
	const physicsScene = $derived(() => ({
		gravity: new THREE.Vector3(0, -9.81, 0),
		dt: 1 / 60,
		worldSize: { x: 1.5, z: 2.5 },
		paused,
		objects,
	}))

	class Ball {
		pos: THREE.Vector3
		radius: number
		vel: THREE.Vector3
		scene: THREE.Scene
		visMesh: THREE.Mesh

		constructor(pos: THREE.Vector3, radius: number, vel: THREE.Vector3, scene: THREE.Scene) {
			this.pos = pos
			this.radius = radius
			this.vel = vel
			this.scene = scene

			const geometry = new THREE.SphereGeometry(radius, 32, 32)
			const material = new THREE.MeshPhongMaterial({ color: 0xff0000 })
			this.visMesh = new THREE.Mesh(geometry, material)
			this.visMesh.position.copy(pos)
			this.scene.add(this.visMesh)
		}

		simulate() {
			this.vel.addScaledVector(physicsScene().gravity, physicsScene().dt)
			this.pos.addScaledVector(this.vel, physicsScene().dt)

			if (this.pos.x < -physicsScene().worldSize.x) {
				this.pos.x = -physicsScene().worldSize.x
				this.vel.x = -this.vel.x
			}

			if (this.pos.x > physicsScene().worldSize.x) {
				this.pos.x = physicsScene().worldSize.x
				this.vel.x = -this.vel.x
			}

			if (this.pos.z < -physicsScene().worldSize.z) {
				this.pos.z = -physicsScene().worldSize.z
				this.vel.z = -this.vel.z
			}

			if (this.pos.z > physicsScene().worldSize.z) {
				this.pos.z = physicsScene().worldSize.z
				this.vel.z = -this.vel.z
			}

			if (this.pos.y < this.radius) {
				this.pos.y = this.radius
				this.vel.y = -this.vel.y
			}

			this.visMesh.position.copy(this.pos)
		}
	}

	onMount(() => {
		if (!containerRef) return

		const container = containerRef

		let raf: number = 0

		let threeScene: THREE.Scene
		let renderer: THREE.WebGLRenderer
		let camera: THREE.PerspectiveCamera
		let cameraControl: OrbitControls

		function initThreeScene() {
			threeScene = new THREE.Scene()

			// Lights
			threeScene.add(new THREE.AmbientLight(0x505050))
			threeScene.fog = new THREE.Fog(0x000000, 0, 15)

			const spotLight = new THREE.SpotLight(0xffffff, 50)
			spotLight.angle = Math.PI / 5
			spotLight.penumbra = 0.2
			spotLight.position.set(2, 3, 3)
			spotLight.castShadow = true
			spotLight.shadow.camera.near = 3
			spotLight.shadow.camera.far = 10
			spotLight.shadow.mapSize.width = 1024
			spotLight.shadow.mapSize.height = 1024
			threeScene.add(spotLight)

			const dirLight = new THREE.DirectionalLight(0x55505a, 1)
			dirLight.position.set(0, 3, 0)
			dirLight.castShadow = true
			dirLight.shadow.camera.near = 1
			dirLight.shadow.camera.far = 10

			dirLight.shadow.camera.right = 1
			dirLight.shadow.camera.left = -1
			dirLight.shadow.camera.top = 1
			dirLight.shadow.camera.bottom = -1

			dirLight.shadow.mapSize.width = 1024
			dirLight.shadow.mapSize.height = 1024
			threeScene.add(dirLight)

			// Geometry
			const ground = new THREE.Mesh(
				new THREE.PlaneGeometry(20, 20, 1, 1),
				new THREE.MeshPhongMaterial({ color: 0xa0adaf, shininess: 150 })
			)

			ground.rotation.x = -Math.PI / 2 // rotates X/Y to X/Z
			ground.receiveShadow = true
			threeScene.add(ground)

			const helper = new THREE.GridHelper(20, 20)
			helper.material.opacity = 1.0
			helper.material.transparent = true
			helper.position.set(0, 0.002, 0)
			threeScene.add(helper)

			// Renderer
			renderer = new THREE.WebGLRenderer()
			renderer.shadowMap.enabled = true
			renderer.setPixelRatio(window.devicePixelRatio)
			renderer.setSize(container.clientWidth, container.clientHeight)
			window.addEventListener('resize', onWindowResize, false)
			container.appendChild(renderer.domElement)

			// Camera
			camera = new THREE.PerspectiveCamera(
				70,
				container.clientWidth / container.clientHeight,
				0.01,
				100
			)
			camera.position.set(0, 1, 4)
			camera.updateMatrixWorld()

			threeScene.add(camera)

			cameraControl = new OrbitControls(camera, renderer.domElement)
			cameraControl.zoomSpeed = 2.0
			cameraControl.panSpeed = 0.4
		}

		function onWindowResize() {
			if (!containerRef) return

			camera.aspect = containerRef.clientWidth / containerRef.clientHeight
			camera.updateProjectionMatrix()
			renderer.setSize(containerRef.clientWidth, containerRef.clientHeight)
		}

		function initPhysics() {
			const radius = 0.2
			const pos = new THREE.Vector3(radius, radius, radius)
			const vel = new THREE.Vector3(2, 5, 3)

			physicsScene().objects.push(new Ball(pos, radius, vel, threeScene))
		}

		function simulate() {
			if (physicsScene().paused) return

			physicsScene().objects.forEach((object) => {
				object.simulate()
			})
		}

		// Main update loop: called every frame via requestAnimationFrame
		function update() {
			simulate()
			renderer.render(threeScene, camera)
			cameraControl.update()
			raf = requestAnimationFrame(update)
		}

		initThreeScene()
		initPhysics()
		update()

		return () => {
			cancelAnimationFrame(raf)
		}
	})

	function toggleSimulation() {
		paused = !paused
	}

	function restartSimulation() {
		location.reload()
	}
</script>

<svelte:head>
	<title>02 - Cannon 3D</title>
</svelte:head>

<h1 class="mb-4 text-2xl font-bold">02 - Cannon 3D</h1>

<div class="grid grid-cols-2 gap-4">
	<div class="aspect-4/3">
		<div id="container" class="h-full rounded border" bind:this={containerRef}></div>
		<div class="mt-2 flex gap-x-1">
			<button class="btn btn-primary" onclick={toggleSimulation}>
				{paused ? 'Run' : 'Stop'}
			</button>
			<button class="btn btn-primary" onclick={restartSimulation}>Restart</button>
		</div>
	</div>

	<CodeHighlight
		code={`

	`}
	/>
</div>
