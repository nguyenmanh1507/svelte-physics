<script lang="ts">
	import { T, useTask } from '@threlte/core'
	import { onMount } from 'svelte'
	import { SvelteSet } from 'svelte/reactivity'
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
		STUNT_CONTROLLER_CONFIG,
		createInitialPlaneState,
		readPlaneInput,
		stepPlaneController,
	} from './plane-controller'
	import {
		getTailWorldPosition,
		getTrailWorldPositionsFromGroup,
		getWingEdgeWorldPositions,
	} from './trail-store'

	type PlaneTelemetry = {
		forwardSpeed: number
		targetSpeed: number
		grounded: boolean
	}

	type TrailData = {
		tailPoint: THREE.Vector3 | null
		leftWingPoint: THREE.Vector3 | null
		rightWingPoint: THREE.Vector3 | null
		forwardSpeed: number
	}

	type Props = {
		trailData?: TrailData
		onTargetReady?: (target: THREE.Object3D) => void
		onTelemetry?: (telemetry: PlaneTelemetry) => void
	}

	let { trailData = $bindable(), onTargetReady, onTelemetry }: Props = $props()

	const config = STUNT_CONTROLLER_CONFIG
	const world = useJoltWorld()
	const rigidBody = useRigidBody({
		shape: { type: 'box', halfExtent: [0.45, 0.15, 1.0], convexRadius: 0.03 },
		motionType: 'kinematic',
		layer: 'moving',
		position: [0, config.groundHeight + config.groundClearance, 0],
	})

	const pressedKeys = new SvelteSet<string>()
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

			if (trailData) {
				const isMoving = result.forwardSpeed > 2
				if (isMoving) {
					const { tailPoint, leftWingPoint, rightWingPoint } = visualGroupRef
						? (() => {
								const { tail, left, right } = getTrailWorldPositionsFromGroup(visualGroupRef)
								return {
									tailPoint: tail,
									leftWingPoint: left,
									rightWingPoint: right,
								}
							})()
						: (() => {
								const tailPoint = getTailWorldPosition(result.position, result.quaternion)
								const { left, right } = getWingEdgeWorldPositions(
									result.position,
									result.quaternion
								)
								return {
									tailPoint,
									leftWingPoint: left,
									rightWingPoint: right,
								}
							})()
					trailData = {
						tailPoint,
						leftWingPoint,
						rightWingPoint,
						forwardSpeed: result.forwardSpeed,
					}
				} else {
					trailData = {
						tailPoint: null,
						leftWingPoint: null,
						rightWingPoint: null,
						forwardSpeed: result.forwardSpeed,
					}
				}
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
		<!-- Body -->
		<T.Mesh position={[0, 0, 0]} castShadow>
			<T.BoxGeometry args={[0.4, 0.25, 2.2]} />
			<T.MeshStandardMaterial color="#f2f2f2" metalness={0.2} roughness={0.6} />
		</T.Mesh>

		<!-- Wing -->
		<T.Mesh position={[0, 0, -1.3]} castShadow>
			<T.ConeGeometry args={[0.18, 0.4, 12]} />
			<T.MeshStandardMaterial color="#0f172a" />
		</T.Mesh>

		<!-- Fuselage -->
		<T.Mesh position={[0, 0.03, 0]} castShadow>
			<T.BoxGeometry args={[2.4, 0.06, 0.55]} />
			<T.MeshStandardMaterial color="#2563eb" />
		</T.Mesh>

		<!-- Tail -->
		<T.Mesh position={[0, 0.2, 0.91]} castShadow>
			<T.BoxGeometry args={[0.1, 0.35, 0.4]} />
			<T.MeshStandardMaterial color="#8100D1" />
		</T.Mesh>

		<!-- Tail fin -->
		<T.Mesh position={[0, 0.25, 0.95]} castShadow>
			<T.BoxGeometry args={[0.7, 0.06, 0.18]} />
			<T.MeshStandardMaterial color="#DA3D20" />
		</T.Mesh>
	</T.Group>
</T.Group>
