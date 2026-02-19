<script lang="ts">
	import { T, useTask } from '@threlte/core'
	import { onMount } from 'svelte'
	import { get } from 'svelte/store'
	import type * as THREE from 'three'

	import {
		JOLT_WORLD_STEP_TASK_KEY,
		toJoltQuat,
		toJoltRVec3,
		useJoltWorld,
		useRigidBody,
	} from '$lib/hooks/use-jolt'
	import {
		DEFAULT_PLANE_CONTROLLER_CONFIG,
		createInitialPlaneState,
		readPlaneInput,
		stepPlaneController,
	} from './plane-controller'

	type PlaneTelemetry = {
		forwardSpeed: number
		targetSpeed: number
		grounded: boolean
	}

	type Props = {
		onTargetReady?: (target: THREE.Object3D) => void
		onTelemetry?: (telemetry: PlaneTelemetry) => void
	}

	let { onTargetReady, onTelemetry }: Props = $props()

	const config = DEFAULT_PLANE_CONTROLLER_CONFIG
	const world = useJoltWorld()
	const rigidBody = useRigidBody({
		shape: { type: 'box', halfExtent: [0.45, 0.15, 1.0], convexRadius: 0.03 },
		motionType: 'kinematic',
		layer: 'moving',
		position: [0, config.groundHeight + config.groundClearance, 0],
	})

	const pressedKeys = new Set<string>()
	let hasEmittedTarget = false
	let visualGroupRef = $state<THREE.Group | undefined>(undefined)
	let controllerState = createInitialPlaneState(config)

	function onPlaneCreate(target: THREE.Object3D) {
		rigidBody.oncreate(target)

		if (!hasEmittedTarget && onTargetReady) {
			hasEmittedTarget = true
			onTargetReady(target)
		}
	}

	onMount(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			pressedKeys.add(event.code)
		}

		const handleKeyUp = (event: KeyboardEvent) => {
			pressedKeys.delete(event.code)
		}

		const handleBlur = () => {
			pressedKeys.clear()
		}

		window.addEventListener('keydown', handleKeyDown)
		window.addEventListener('keyup', handleKeyUp)
		window.addEventListener('blur', handleBlur)

		return () => {
			window.removeEventListener('keydown', handleKeyDown)
			window.removeEventListener('keyup', handleKeyUp)
			window.removeEventListener('blur', handleBlur)
			pressedKeys.clear()
		}
	})

	useTask(
		'arcade-plane-controller',
		(delta) => {
			const body = get(rigidBody.body)
			const JoltModule = get(world.module)
			const bodyInterface = get(world.bodyInterface)
			const isReady = get(world.isReady)
			if (!isReady || !body || !JoltModule || !bodyInterface) return

			const clampedDelta = Math.min(delta, 1 / 30)
			const input = readPlaneInput(pressedKeys, controllerState, clampedDelta, config)
			const result = stepPlaneController(controllerState, input, clampedDelta, config)
			controllerState = result.nextState

			const position = toJoltRVec3(JoltModule, [
				result.position.x,
				result.position.y,
				result.position.z,
			])
			const rotation = toJoltQuat(JoltModule, [
				result.quaternion.x,
				result.quaternion.y,
				result.quaternion.z,
				result.quaternion.w,
			])

			bodyInterface.MoveKinematic(body.GetID(), position, rotation, clampedDelta)
			JoltModule.destroy(position)
			JoltModule.destroy(rotation)

			if (visualGroupRef) {
				visualGroupRef.rotation.z = result.bankAngle
			}

			if (onTelemetry) {
				onTelemetry({
					forwardSpeed: result.forwardSpeed,
					targetSpeed: result.targetSpeed,
					grounded: result.grounded,
				})
			}
		},
		{ before: JOLT_WORLD_STEP_TASK_KEY }
	)
</script>

<T.Group
	position={[0, config.groundHeight + config.groundClearance, 0]}
	oncreate={onPlaneCreate}
	castShadow
>
	<T.Group bind:ref={visualGroupRef}>
		<T.Mesh position={[0, 0, 0]} castShadow>
			<T.BoxGeometry args={[0.4, 0.25, 2.2]} />
			<T.MeshStandardMaterial color="#f2f2f2" metalness={0.2} roughness={0.6} />
		</T.Mesh>

		<T.Mesh position={[0, 0, -1.3]} castShadow>
			<T.ConeGeometry args={[0.18, 0.4, 12]} />
			<T.MeshStandardMaterial color="#0f172a" />
		</T.Mesh>

		<T.Mesh position={[0, 0.03, 0]} castShadow>
			<T.BoxGeometry args={[2.4, 0.06, 0.55]} />
			<T.MeshStandardMaterial color="#2563eb" />
		</T.Mesh>

		<T.Mesh position={[0, 0.2, 0.9]} castShadow>
			<T.BoxGeometry args={[0.1, 0.35, 0.4]} />
			<T.MeshStandardMaterial color="#1d4ed8" />
		</T.Mesh>

		<T.Mesh position={[0, 0.25, 0.95]} castShadow>
			<T.BoxGeometry args={[0.7, 0.06, 0.18]} />
			<T.MeshStandardMaterial color="#2563eb" />
		</T.Mesh>
	</T.Group>
</T.Group>
