<script lang="ts">
	import { useTask } from '@threlte/core'
	import type { Snippet } from 'svelte'
	import { onDestroy, onMount, setContext } from 'svelte'
	import { get, writable } from 'svelte/store'
	import type JoltType from 'jolt-physics/wasm-compat'
	import type * as THREE from 'three'
	import {
		DEFAULT_MAX_DELTA,
		DEFAULT_MOTION_TYPE,
		DEFAULT_NORMAL_SUB_STEPS,
		DEFAULT_SLOW_FRAME_SUB_STEPS,
		DEFAULT_SUB_STEP_THRESHOLD,
		JOLT_WORLD_STEP_TASK_KEY,
		OBJECT_LAYER_BY_NAME,
	} from './constants'
	import { toJoltQuat, toJoltRVec3, toJoltVec3, toThreeQuat, toThreeVec3 } from './convert'
	import { JOLT_WORLD_CONTEXT_KEY, type JoltWorldContext } from './context'
	import { createJoltWorld, getJoltModule } from './world'
	import type { JoltShapeOptions, JoltWorldStepConfig, MotionType } from './types'

	type Props = JoltWorldStepConfig & {
		children?: Snippet
	}

	let {
		maxDelta = DEFAULT_MAX_DELTA,
		subStepThreshold = DEFAULT_SUB_STEP_THRESHOLD,
		slowFrameSubSteps = DEFAULT_SLOW_FRAME_SUB_STEPS,
		normalSubSteps = DEFAULT_NORMAL_SUB_STEPS,
		autoStep = true,
		children,
	}: Props = $props()

	const moduleStore = writable<typeof JoltType | null>(null)
	const joltStore = writable<JoltType.JoltInterface | null>(null)
	const physicsSystemStore = writable<JoltType.PhysicsSystem | null>(null)
	const bodyInterfaceStore = writable<JoltType.BodyInterface | null>(null)
	const isReady = writable(false)
	const error = writable<unknown>(null)

	const syncedBodies = new Map<THREE.Object3D, JoltType.Body>()
	const createdBodies = new Map<number, JoltType.BodyID>()

	function resolveMotionType(motionType?: MotionType): MotionType {
		return motionType ?? DEFAULT_MOTION_TYPE
	}

	function motionTypeToJolt(JoltModule: typeof JoltType, motionType: MotionType) {
		if (motionType === 'static') return JoltModule.EMotionType_Static
		if (motionType === 'kinematic') return JoltModule.EMotionType_Kinematic
		return JoltModule.EMotionType_Dynamic
	}

	function createShape(JoltModule: typeof JoltType, shape: JoltShapeOptions) {
		if (shape.type === 'sphere') {
			return new JoltModule.SphereShape(shape.radius)
		}

		return new JoltModule.BoxShape(
			toJoltVec3(JoltModule, shape.halfExtent),
			shape.convexRadius ?? 0.05
		)
	}

	const context: JoltWorldContext = {
		module: moduleStore,
		jolt: joltStore,
		physicsSystem: physicsSystemStore,
		bodyInterface: bodyInterfaceStore,
		isReady,
		error,
		createBody(mesh, options) {
			const JoltModule = get(moduleStore)
			const bodyInterface = get(bodyInterfaceStore)
			if (!JoltModule || !bodyInterface) return null

			const motionType = resolveMotionType(options.motionType)
			const resolvedLayer = options.layer ?? (motionType === 'static' ? 'nonMoving' : 'moving')

			const shape = createShape(JoltModule, options.shape)
			const position = options.position ?? [mesh.position.x, mesh.position.y, mesh.position.z]
			const rotation = options.rotation ?? [
				mesh.quaternion.x,
				mesh.quaternion.y,
				mesh.quaternion.z,
				mesh.quaternion.w,
			]

			const creationSettings = new JoltModule.BodyCreationSettings(
				shape,
				toJoltRVec3(JoltModule, position),
				toJoltQuat(JoltModule, rotation),
				motionTypeToJolt(JoltModule, motionType),
				OBJECT_LAYER_BY_NAME[resolvedLayer]
			)

			if (options.restitution !== undefined) {
				creationSettings.mRestitution = options.restitution
			}
			if (options.friction !== undefined) {
				creationSettings.mFriction = options.friction
			}

			const body = bodyInterface.CreateBody(creationSettings)
			JoltModule.destroy(creationSettings)

			const bodyId = body.GetID()
			const bodyKey = bodyId.GetIndexAndSequenceNumber()
			bodyInterface.AddBody(bodyId, JoltModule.EActivation_Activate)
			createdBodies.set(bodyKey, bodyId)

			if (options.linearVelocity) {
				const linearVelocity = toJoltVec3(JoltModule, options.linearVelocity)
				bodyInterface.SetLinearVelocity(bodyId, linearVelocity)
				JoltModule.destroy(linearVelocity)
			}

			if (options.angularVelocity) {
				const angularVelocity = toJoltVec3(JoltModule, options.angularVelocity)
				bodyInterface.SetAngularVelocity(bodyId, angularVelocity)
				JoltModule.destroy(angularVelocity)
			}

			return body
		},
		destroyBody(bodyId) {
			const JoltModule = get(moduleStore)
			const bodyInterface = get(bodyInterfaceStore)
			if (!JoltModule || !bodyInterface) return

			const bodyKey = bodyId.GetIndexAndSequenceNumber()
			const trackedBodyId = createdBodies.get(bodyKey)
			if (!trackedBodyId) return

			bodyInterface.RemoveBody(trackedBodyId)
			bodyInterface.DestroyBody(trackedBodyId)
			createdBodies.delete(bodyKey)
		},
		registerSync(mesh, body) {
			syncedBodies.set(mesh, body)
		},
		unregisterSync(mesh) {
			syncedBodies.delete(mesh)
		},
	}

	setContext(JOLT_WORLD_CONTEXT_KEY, context)

	onMount(() => {
		let cancelled = false

		getJoltModule()
			.then((JoltModule) => {
				if (cancelled) return

				const world = createJoltWorld(JoltModule)
				moduleStore.set(JoltModule)
				joltStore.set(world.jolt)
				physicsSystemStore.set(world.physicsSystem)
				bodyInterfaceStore.set(world.bodyInterface)
				isReady.set(true)
			})
			.catch((initError) => {
				if (!cancelled) {
					error.set(initError)
				}
			})

		return () => {
			cancelled = true
		}
	})

	useTask(JOLT_WORLD_STEP_TASK_KEY, (delta) => {
		if (!autoStep) return

		const jolt = get(joltStore)
		if (!jolt) return

		const clampedDelta = Math.min(delta, maxDelta)
		const numSteps = clampedDelta > subStepThreshold ? slowFrameSubSteps : normalSubSteps

		jolt.Step(clampedDelta, numSteps)

		for (const [mesh, body] of syncedBodies) {
			mesh.position.copy(toThreeVec3(body.GetPosition()))
			mesh.quaternion.copy(toThreeQuat(body.GetRotation()))
		}
	})

	onDestroy(() => {
		const JoltModule = get(moduleStore)
		const bodyInterface = get(bodyInterfaceStore)
		if (JoltModule && bodyInterface) {
			for (const bodyId of createdBodies.values()) {
				bodyInterface.RemoveBody(bodyId)
				bodyInterface.DestroyBody(bodyId)
			}
		}

		createdBodies.clear()
		syncedBodies.clear()
		isReady.set(false)
	})
</script>

{@render children?.()}
