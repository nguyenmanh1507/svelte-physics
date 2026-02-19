import { onDestroy } from 'svelte'
import { get, writable } from 'svelte/store'
import type JoltType from 'jolt-physics/wasm-compat'
import type * as THREE from 'three'
import { useJoltWorld } from './context'
import type { RigidBodyOptions } from './types'

type OptionsFactory = RigidBodyOptions | (() => RigidBodyOptions)

function resolveOptions(options: OptionsFactory): RigidBodyOptions {
	return typeof options === 'function' ? options() : options
}

export function useRigidBody(options: OptionsFactory) {
	const world = useJoltWorld()
	const bodyStore = writable<JoltType.Body | null>(null)

	let mesh: THREE.Object3D | null = null
	let bodyId: JoltType.BodyID | null = null
	let isDestroyed = false
	let isSynced = false

	function isStaticBody() {
		const currentOptions = resolveOptions(options)
		const motionType = currentOptions.motionType ?? 'dynamic'
		return motionType === 'static'
	}

	function createBodyIfReady() {
		if (isDestroyed || !mesh || bodyId || !get(world.isReady)) return

		const currentOptions = resolveOptions(options)
		const body = world.createBody(mesh, currentOptions)
		if (!body) return

		bodyId = body.GetID()
		bodyStore.set(body)
		mesh.userData.body = body

		if (!isStaticBody()) {
			world.registerSync(mesh, body)
			isSynced = true
		}
	}

	function oncreate(target: THREE.Object3D) {
		mesh = target
		createBodyIfReady()
	}

	function destroy() {
		if (isDestroyed) return

		isDestroyed = true
		if (mesh && isSynced) {
			world.unregisterSync(mesh)
			isSynced = false
		}
		if (bodyId) {
			world.destroyBody(bodyId)
			bodyId = null
		}
		if (mesh?.userData.body) {
			delete mesh.userData.body
		}
		bodyStore.set(null)
	}

	const unsubscribeReady = world.isReady.subscribe(() => {
		createBodyIfReady()
	})

	onDestroy(() => {
		unsubscribeReady()
		destroy()
	})

	return {
		oncreate,
		body: {
			subscribe: bodyStore.subscribe,
		},
		destroy,
	}
}
