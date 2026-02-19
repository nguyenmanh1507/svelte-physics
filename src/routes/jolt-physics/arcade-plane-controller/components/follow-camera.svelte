<script lang="ts">
	import { T, useTask } from '@threlte/core'
	import * as THREE from 'three'

	type Props = {
		target?: THREE.Object3D
		offset?: [number, number, number]
		lookAhead?: number
		positionLerp?: number
		lookLerp?: number
	}

	let {
		target,
		offset = [0, 2.5, 8],
		lookAhead = 8,
		positionLerp = 4,
		lookLerp = 6,
	}: Props = $props()

	let cameraRef = $state<THREE.PerspectiveCamera | undefined>(undefined)

	const worldOffset = new THREE.Vector3()
	const desiredPosition = new THREE.Vector3()
	const forward = new THREE.Vector3()
	const desiredLookAt = new THREE.Vector3()
	const smoothedLookAt = new THREE.Vector3()
	let hasLookTarget = false

	function smoothFactor(rate: number, delta: number) {
		return 1 - Math.exp(-rate * delta)
	}

	useTask((delta) => {
		if (!cameraRef || !target) return

		worldOffset.fromArray(offset).applyQuaternion(target.quaternion)
		desiredPosition.copy(target.position).add(worldOffset)
		cameraRef.position.lerp(desiredPosition, smoothFactor(positionLerp, delta))

		forward.set(0, 0, -1).applyQuaternion(target.quaternion)
		desiredLookAt.copy(target.position).addScaledVector(forward, lookAhead)

		if (!hasLookTarget) {
			smoothedLookAt.copy(desiredLookAt)
			hasLookTarget = true
		} else {
			smoothedLookAt.lerp(desiredLookAt, smoothFactor(lookLerp, delta))
		}

		cameraRef.lookAt(smoothedLookAt)
	})
</script>

<T.PerspectiveCamera bind:ref={cameraRef} makeDefault fov={60} near={0.1} far={1000} />
