<script lang="ts">
	import * as THREE from 'three'
	import { T } from '@threlte/core'
	import { Gizmo, OrbitControls } from '@threlte/extras'
	import { JoltRigidBody, JoltWorld } from '$lib/hooks/use-jolt'

	const showHelper = false

	type SphereConfig = {
		id: number
		radius: number
		texture: THREE.Texture | null
		fallbackColor: number
		position: [number, number, number]
	}

	const floorTexturePath = '/images/prototype-texture/Dark/texture_01.png'
	const prototypeTexturePaths = [
		'/images/prototype-texture/Green/texture_07.png',
		'/images/prototype-texture/Orange/texture_07.png',
		'/images/prototype-texture/Light/texture_07.png',
		'/images/prototype-texture/Purple/texture_07.png',
		'/images/prototype-texture/Red/texture_07.png',
		floorTexturePath,
	]
	const sphereTexturePaths = prototypeTexturePaths.filter((path) => path !== floorTexturePath)
	const textureLoader = new THREE.TextureLoader()
	const textureCache = new Map<string, THREE.Texture>()

	function loadTexture(path: string, repeatX = 1, repeatY = 1) {
		const texture = textureLoader.load(path)
		texture.wrapS = THREE.RepeatWrapping
		texture.wrapT = THREE.RepeatWrapping
		texture.repeat.set(repeatX, repeatY)
		return texture
	}

	function getCachedTexture(path: string) {
		const cachedTexture = textureCache.get(path)
		if (cachedTexture) return cachedTexture

		const texture = loadTexture(path)
		textureCache.set(path, texture)
		return texture
	}

	function getRandomSphereTexture() {
		if (sphereTexturePaths.length === 0) return null
		const randomPath = sphereTexturePaths[Math.floor(Math.random() * sphereTexturePaths.length)]
		return getCachedTexture(randomPath)
	}

	const floorTexture = loadTexture(floorTexturePath, 25, 25)

	const sphereConfigs: SphereConfig[] = Array.from({ length: 10 }, (_, index) => ({
		id: index,
		radius: 0.5 + Math.random() * 0.5,
		texture: getRandomSphereTexture(),
		fallbackColor: Math.floor(Math.random() * 0xffffff),
		position: [(Math.random() - 0.5) * 10, 10 + index * 2, (Math.random() - 0.5) * 10],
	}))

	let dirLightRef = $state<THREE.DirectionalLight | undefined>(undefined)
</script>

<JoltWorld>
	<T.PerspectiveCamera makeDefault position={[0, 15, 30]} lookAt.y={0}>
		<OrbitControls>
			<Gizmo />
		</OrbitControls>
	</T.PerspectiveCamera>

	<T.DirectionalLight
		bind:ref={dirLightRef}
		position={[10, 60, 5]}
		castShadow
		shadow.camera.left={-50}
		shadow.camera.right={50}
		shadow.camera.top={50}
		shadow.camera.bottom={-50}
		shadow.camera.near={1}
		shadow.camera.far={100}
		shadow.mapSize={[2048, 2048]}
	/>
	<T.AmbientLight intensity={0.3} />
	<!-- <T.GridHelper args={[50, 50]} /> -->

	<JoltRigidBody
		shape={{ type: 'box', halfExtent: [50, 0.5, 50], convexRadius: 0.05 }}
		motionType="static"
		layer="nonMoving"
	>
		{#snippet children({ oncreate })}
			<T.Mesh position={[0, -0.5, 0]} receiveShadow {oncreate}>
				<T.BoxGeometry args={[100, 1, 100]} />
				<T.MeshStandardMaterial map={floorTexture} />
			</T.Mesh>
		{/snippet}
	</JoltRigidBody>

	{#each sphereConfigs as sphere (sphere.id)}
		<JoltRigidBody
			shape={{ type: 'sphere', radius: sphere.radius }}
			motionType="dynamic"
			layer="moving"
			position={sphere.position}
			restitution={0.5}
		>
			{#snippet children({ oncreate })}
				<T.Mesh position={sphere.position} castShadow {oncreate}>
					<T.SphereGeometry args={[sphere.radius, 32, 32]} />
					<T.MeshStandardMaterial map={sphere.texture ?? undefined} color={sphere.fallbackColor} />
				</T.Mesh>
			{/snippet}
		</JoltRigidBody>
	{/each}

	{#if dirLightRef && showHelper}
		<T.CameraHelper args={[dirLightRef.shadow.camera]} />
	{/if}
</JoltWorld>
