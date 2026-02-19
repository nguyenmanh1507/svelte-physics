import initJolt from 'jolt-physics/wasm-compat'
import type JoltType from 'jolt-physics/wasm-compat'
import {
	LAYER_MOVING,
	LAYER_NON_MOVING,
	NUM_BROAD_PHASE_LAYERS,
	NUM_OBJECT_LAYERS,
} from './constants'

let joltModulePromise: Promise<typeof JoltType> | null = null

export function getJoltModule() {
	if (!joltModulePromise) {
		joltModulePromise = initJolt()
	}

	return joltModulePromise
}

function setupCollisionFiltering(JoltModule: typeof JoltType, settings: JoltType.JoltSettings) {
	const objectFilter = new JoltModule.ObjectLayerPairFilterTable(NUM_OBJECT_LAYERS)
	objectFilter.EnableCollision(LAYER_NON_MOVING, LAYER_MOVING)
	objectFilter.EnableCollision(LAYER_MOVING, LAYER_MOVING)

	const bpLayerNonMoving = new JoltModule.BroadPhaseLayer(0)
	const bpLayerMoving = new JoltModule.BroadPhaseLayer(1)

	const bpInterface = new JoltModule.BroadPhaseLayerInterfaceTable(
		NUM_OBJECT_LAYERS,
		NUM_BROAD_PHASE_LAYERS
	)
	bpInterface.MapObjectToBroadPhaseLayer(LAYER_NON_MOVING, bpLayerNonMoving)
	bpInterface.MapObjectToBroadPhaseLayer(LAYER_MOVING, bpLayerMoving)

	settings.mObjectLayerPairFilter = objectFilter
	settings.mBroadPhaseLayerInterface = bpInterface
	settings.mObjectVsBroadPhaseLayerFilter = new JoltModule.ObjectVsBroadPhaseLayerFilterTable(
		settings.mBroadPhaseLayerInterface,
		NUM_BROAD_PHASE_LAYERS,
		settings.mObjectLayerPairFilter,
		NUM_OBJECT_LAYERS
	)
}

export function createJoltWorld(JoltModule: typeof JoltType) {
	const settings = new JoltModule.JoltSettings()
	setupCollisionFiltering(JoltModule, settings)

	const jolt = new JoltModule.JoltInterface(settings)
	JoltModule.destroy(settings)

	const physicsSystem = jolt.GetPhysicsSystem()
	const bodyInterface = physicsSystem.GetBodyInterface()

	return {
		jolt,
		physicsSystem,
		bodyInterface,
	}
}
