import { getContext } from 'svelte'
import type { Readable } from 'svelte/store'
import type JoltType from 'jolt-physics/wasm-compat'
import type * as THREE from 'three'
import type { RigidBodyOptions } from './types'

export type JoltWorldContext = {
	module: Readable<typeof JoltType | null>
	jolt: Readable<JoltType.JoltInterface | null>
	physicsSystem: Readable<JoltType.PhysicsSystem | null>
	bodyInterface: Readable<JoltType.BodyInterface | null>
	isReady: Readable<boolean>
	error: Readable<unknown>
	createBody: (mesh: THREE.Object3D, options: RigidBodyOptions) => JoltType.Body | null
	destroyBody: (bodyId: JoltType.BodyID) => void
	registerSync: (mesh: THREE.Object3D, body: JoltType.Body) => void
	unregisterSync: (mesh: THREE.Object3D) => void
}

export const JOLT_WORLD_CONTEXT_KEY = Symbol('jolt-world-context')

export function useJoltWorld() {
	const context = getContext<JoltWorldContext | undefined>(JOLT_WORLD_CONTEXT_KEY)
	if (!context) {
		throw new Error('useJoltWorld must be used within <JoltWorld>.')
	}

	return context
}
