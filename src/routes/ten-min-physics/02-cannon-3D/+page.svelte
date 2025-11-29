<script lang="ts">
	import { onMount } from 'svelte'
	import { CodeHighlight } from '~/lib/components/code-highlight'
	import * as THREE from 'three'
	import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

	let containerRef: HTMLDivElement | undefined

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

			const spotLight = new THREE.SpotLight(0xffffff)
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

			// Objects
			const sphereGeometry = new THREE.SphereGeometry(0.2, 32, 32)
			const sphereMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 })
			const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial)
			sphere.position.set(0, 1, 0)
			threeScene.add(sphere)
		}

		function onWindowResize() {
			if (!containerRef) return

			camera.aspect = containerRef.clientWidth / containerRef.clientHeight
			camera.updateProjectionMatrix()
			renderer.setSize(containerRef.clientWidth, containerRef.clientHeight)
		}

		// Physics simulation function: updates ball position and velocity
		function simulate() {}

		// Main update loop: called every frame via requestAnimationFrame
		function update() {
			simulate()
			renderer.render(threeScene, camera)
			cameraControl.update()
			raf = requestAnimationFrame(update)
		}

		initThreeScene()
		update()

		return () => {
			cancelAnimationFrame(raf)
		}
	})
</script>

<svelte:head>
	<title>02 - Cannon 3D</title>
</svelte:head>

<h1 class="mb-4 text-2xl font-bold">02 - Cannon 3D</h1>

<div class="grid grid-cols-2 gap-4">
	<div id="container" class="aspect-4/3 w-full rounded border" bind:this={containerRef}></div>

	<CodeHighlight
		code={`

	`}
	/>
</div>
