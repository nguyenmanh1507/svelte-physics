<script lang="ts">
	import * as THREE from 'three'
	import { T, useTask, useThrelte } from '@threlte/core'
	import { Gizmo, OrbitControls } from '@threlte/extras'

	import { useJolt, wrapVec3, wrapQuat } from '$lib/hooks/use-jolt'

	const { isReady, jolt, physicsSystem, bodyInterface, dynamicObjects } = useJolt()
	const { renderer, scene, camera } = useThrelte()

	let boxMesh: THREE.Mesh

	$effect(() => {
		if (!isReady) return

		dynamicObjects.update((objects) => {
			objects.push(boxMesh)
			return objects
		})
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

		renderer.render(scene, camera.current)
	})
</script>

<T.PerspectiveCamera makeDefault position={[10, 7, 6]} lookAt.y={0}>
	<OrbitControls>
		<Gizmo />
	</OrbitControls>
</T.PerspectiveCamera>

<T.DirectionalLight position.y={10} position.z={10} />
<T.AmbientLight intensity={0.3} />
<T.GridHelper args={[10, 10]} />

<T.Mesh bind:ref={boxMesh} position={[0, 5, 0]}>
	<T.BoxGeometry args={[1, 1, 1]} />
	<T.MeshBasicMaterial color="red" />
</T.Mesh>
