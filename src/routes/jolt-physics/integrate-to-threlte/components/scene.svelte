<script lang="ts">
	import * as THREE from 'three'
	import { onDestroy } from 'svelte'
	import { T, useTask } from '@threlte/core'
	import { Gizmo, OrbitControls } from '@threlte/extras'
	import type JoltType from 'jolt-physics/wasm-compat'

	import { useJolt, wrapVec3, wrapQuat } from '$lib/hooks/use-jolt'

	const showHelper = false

	// Object layers for collision filtering
	const LAYER_NON_MOVING = 0
	const LAYER_MOVING = 1

	type SphereConfig = {
		id: number
		radius: number
		color: number
		position: [number, number, number]
	}

	const sphereConfigs: SphereConfig[] = Array.from({ length: 10 }, (_, index) => ({
		id: index,
		radius: 0.5 + Math.random() * 0.5,
		color: Math.floor(Math.random() * 0xffffff),
		position: [(Math.random() - 0.5) * 10, 10 + index * 2, (Math.random() - 0.5) * 10],
	}))

	const { isReady, jolt, bodyInterface, dynamicObjects } = useJolt()

	let floorMesh = $state<THREE.Mesh | undefined>(undefined)
	let sphereMeshes = $state<(THREE.Mesh | undefined)[]>(
		Array.from({ length: sphereConfigs.length }, () => undefined)
	)
	let dirLightRef = $state<THREE.DirectionalLight | undefined>(undefined)

	const createdBodyIds: JoltType.BodyID[] = []
	let hasInitializedBodies = false

	function createFloorBody(bodyInterfaceRef: JoltType.BodyInterface, mesh: THREE.Mesh) {
		const JoltModule = globalThis.Jolt
		if (!JoltModule) return

		const shape = new JoltModule.BoxShape(new JoltModule.Vec3(50, 0.5, 50), 0.05)
		const creationSettings = new JoltModule.BodyCreationSettings(
			shape,
			new JoltModule.RVec3(mesh.position.x, mesh.position.y, mesh.position.z),
			new JoltModule.Quat(
				mesh.quaternion.x,
				mesh.quaternion.y,
				mesh.quaternion.z,
				mesh.quaternion.w
			),
			JoltModule.EMotionType_Static,
			LAYER_NON_MOVING
		)
		const body = bodyInterfaceRef.CreateBody(creationSettings)
		JoltModule.destroy(creationSettings)

		bodyInterfaceRef.AddBody(body.GetID(), JoltModule.EActivation_Activate)
		mesh.userData.body = body
		createdBodyIds.push(body.GetID())
	}

	function createSphereBody(
		bodyInterfaceRef: JoltType.BodyInterface,
		mesh: THREE.Mesh,
		config: SphereConfig
	) {
		const JoltModule = globalThis.Jolt
		if (!JoltModule) return

		const shape = new JoltModule.SphereShape(config.radius)
		const creationSettings = new JoltModule.BodyCreationSettings(
			shape,
			new JoltModule.RVec3(...config.position),
			JoltModule.Quat.prototype.sIdentity(),
			JoltModule.EMotionType_Dynamic,
			LAYER_MOVING
		)
		creationSettings.mRestitution = 0.5

		const body = bodyInterfaceRef.CreateBody(creationSettings)
		JoltModule.destroy(creationSettings)

		bodyInterfaceRef.AddBody(body.GetID(), JoltModule.EActivation_Activate)
		mesh.userData.body = body
		createdBodyIds.push(body.GetID())
	}

	$effect(() => {
		if (!$isReady || !$bodyInterface || !floorMesh || hasInitializedBodies) return
		if (sphereMeshes.some((mesh) => mesh === undefined)) return

		const bodyInterfaceRef = $bodyInterface
		createFloorBody(bodyInterfaceRef, floorMesh)

		const readySphereMeshes = sphereMeshes.filter((mesh): mesh is THREE.Mesh => mesh !== undefined)
		readySphereMeshes.forEach((mesh, index) => {
			createSphereBody(bodyInterfaceRef, mesh, sphereConfigs[index])
		})

		dynamicObjects.set(readySphereMeshes)
		hasInitializedBodies = true
	})

	useTask((delta) => {
		if (!$jolt) return

		// Get delta time (clamped to prevent spiral of death)
		const clampedDelta = Math.min(delta, 1.0 / 30.0)

		// Step physics simulation
		// Use 2 sub-steps when framerate drops below 55 Hz
		const numSteps = clampedDelta > 1.0 / 55.0 ? 2 : 1
		$jolt.Step(clampedDelta, numSteps)

		// Sync Three.js meshes with physics bodies
		for (const mesh of $dynamicObjects) {
			const body = mesh.userData.body
			if (body) {
				mesh.position.copy(wrapVec3(body.GetPosition()))
				mesh.quaternion.copy(wrapQuat(body.GetRotation()))
			}
		}
	})

	onDestroy(() => {
		const JoltModule = globalThis.Jolt
		const bodyInterfaceRef = $bodyInterface
		if (!JoltModule || !bodyInterfaceRef) return

		for (const bodyId of createdBodyIds) {
			bodyInterfaceRef.RemoveBody(bodyId)
			bodyInterfaceRef.DestroyBody(bodyId)
		}

		dynamicObjects.set([])
	})
</script>

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

<T.Mesh bind:ref={floorMesh} position={[0, -0.5, 0]} receiveShadow>
	<T.BoxGeometry args={[100, 1, 100]} />
	<T.MeshStandardMaterial color="#c7c7c7" />
</T.Mesh>

{#each sphereConfigs as sphere, index (sphere.id)}
	<T.Mesh
		position={sphere.position}
		castShadow
		oncreate={(mesh) => {
			sphereMeshes[index] = mesh
		}}
	>
		<T.SphereGeometry args={[sphere.radius, 32, 32]} />
		<T.MeshStandardMaterial color={sphere.color} />
	</T.Mesh>
{/each}

{#if dirLightRef && showHelper}
	<T.CameraHelper args={[dirLightRef.shadow.camera]} />
{/if}
