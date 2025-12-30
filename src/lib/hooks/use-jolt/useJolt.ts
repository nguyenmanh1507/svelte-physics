import { onMount } from 'svelte'
import { writable } from 'svelte/store'
import initJolt from 'jolt-physics'
import type JoltType from 'jolt-physics'
import * as THREE from 'three'

// Object layers for collision filtering
const LAYER_NON_MOVING = 0
const LAYER_MOVING = 1
const NUM_OBJECT_LAYERS = 2

export function useJolt() {
	const jolt = writable<JoltType.JoltInterface | null>(null)
	const physicsSystem = writable<JoltType.PhysicsSystem | null>(null)
	const bodyInterface = writable<JoltType.BodyInterface | null>(null)
	const isReady = writable(false)
	const error = writable<unknown>(null)
	const dynamicObjects = writable<THREE.Object3D[]>([])

	function setupCollisionFiltering(settings: JoltType.JoltSettings) {
		if (!Jolt) return

		// Define which layers can collide with each other
		const objectFilter = new Jolt.ObjectLayerPairFilterTable(NUM_OBJECT_LAYERS)
		objectFilter.EnableCollision(LAYER_NON_MOVING, LAYER_MOVING)
		objectFilter.EnableCollision(LAYER_MOVING, LAYER_MOVING)

		// Map object layers to broadphase layers
		const BP_LAYER_NON_MOVING = new Jolt.BroadPhaseLayer(0)
		const BP_LAYER_MOVING = new Jolt.BroadPhaseLayer(1)
		const NUM_BROAD_PHASE_LAYERS = 2

		const bpInterface = new Jolt.BroadPhaseLayerInterfaceTable(
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

	function initPhysics(JoltModule: typeof JoltType) {
		window.Jolt = Jolt // Store Jolt in window for global access

		// Create settings
		const settings = new JoltModule.JoltSettings()
		setupCollisionFiltering(settings)
		const ji = new JoltModule.JoltInterface(settings)
		JoltModule.destroy(settings)

		// Set references to main systems
		jolt.set(ji)

		const ps = ji.GetPhysicsSystem()
		physicsSystem.set(ps)
		bodyInterface.set(ps.GetBodyInterface())

		isReady.set(true)
	}

	onMount(() => {
		let cancelled = false

		initJolt()
			.then((JoltModule) => {
				if (cancelled) return

				initPhysics(JoltModule)
			})
			.catch((e) => {
				if (!cancelled) error.set(e)
			})

		return () => {
			cancelled = true
		}
	})

	return { jolt, physicsSystem, bodyInterface, isReady, error, dynamicObjects }
}

/**
 * Helper functions to convert Jolt vectors/quaternions to Three.js and vice versa
 * ================================
 */

// Convert Jolt vectors/quaternions to Three.js
export const wrapVec3 = (v: JoltType.RVec3 | JoltType.Vec3) =>
	new THREE.Vector3(v.GetX(), v.GetY(), v.GetZ())
export const wrapQuat = (q: JoltType.Quat) =>
	new THREE.Quaternion(q.GetX(), q.GetY(), q.GetZ(), q.GetW())

// Convert Three.js to Jolt
export const unwrapVec3 = (v: THREE.Vector3) => new Jolt!.Vec3(v.x, v.y, v.z)
export const unwrapRVec3 = (v: THREE.Vector3) => new Jolt!.RVec3(v.x, v.y, v.z)
export const unwrapQuat = (q: THREE.Quaternion) => new Jolt!.Quat(q.x, q.y, q.z, q.w)
// ================================
