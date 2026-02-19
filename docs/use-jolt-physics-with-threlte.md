# Integrate Jolt Physics into Threlte

This guide mirrors the implementation in:

- `src/routes/jolt-physics/integrate-to-threlte/+page.svelte`
- `src/routes/jolt-physics/integrate-to-threlte/components/scene.svelte`
- `src/lib/hooks/use-jolt/useJolt.ts`

## 1. Install dependencies

```bash
pnpm add jolt-physics three @threlte/core @threlte/extras
```

## 2. Create a reusable Jolt hook

Create `src/lib/hooks/use-jolt/useJolt.ts` and initialize Jolt inside `onMount`.

Key points:

- call `initJolt()` from `jolt-physics/wasm-compat`
- create `JoltSettings` and configure collision filtering
- create `JoltInterface`, then expose `PhysicsSystem` and `BodyInterface`
- store readiness and dynamic object references in Svelte stores

Minimal shape:

```ts
import { onMount } from 'svelte'
import { writable } from 'svelte/store'
import initJolt from 'jolt-physics/wasm-compat'
import type JoltType from 'jolt-physics/wasm-compat'
import * as THREE from 'three'

export function useJolt() {
	const jolt = writable<JoltType.JoltInterface | null>(null)
	const bodyInterface = writable<JoltType.BodyInterface | null>(null)
	const isReady = writable(false)
	const dynamicObjects = writable<THREE.Object3D[]>([])

	onMount(() => {
		initJolt().then((JoltModule) => {
			window.Jolt = JoltModule
			globalThis.Jolt = JoltModule

			const settings = new JoltModule.JoltSettings()
			// configure layer + broadphase filtering here
			const ji = new JoltModule.JoltInterface(settings)
			JoltModule.destroy(settings)

			jolt.set(ji)
			bodyInterface.set(ji.GetPhysicsSystem().GetBodyInterface())
			isReady.set(true)
		})
	})

	return { jolt, bodyInterface, isReady, dynamicObjects }
}
```

Also add vector/quaternion wrappers for syncing Three.js transforms:

```ts
export const wrapVec3 = (v: JoltType.RVec3 | JoltType.Vec3) =>
	new THREE.Vector3(v.GetX(), v.GetY(), v.GetZ())

export const wrapQuat = (q: JoltType.Quat) =>
	new THREE.Quaternion(q.GetX(), q.GetY(), q.GetZ(), q.GetW())
```

And export from `src/lib/hooks/use-jolt/index.ts`:

```ts
export * from './useJolt'
```

## 3. Mount Threlte canvas in the route

Your route page only needs to host `Canvas` and scene content.

```svelte
<!-- src/routes/jolt-physics/integrate-to-threlte/+page.svelte -->
<script lang="ts">
	import { Canvas } from '@threlte/core'
	import Scene from './components/scene.svelte'
</script>

<Canvas shadows>
	<Scene />
</Canvas>
```

## 4. Build physics scene and register bodies

In `scene.svelte`:

- call `useJolt()`
- wait until Jolt is ready and mesh refs exist
- create static body for floor
- create dynamic bodies for spheres
- keep body ids for cleanup

Example flow:

```ts
const { isReady, jolt, bodyInterface, dynamicObjects } = useJolt()
const createdBodyIds: JoltType.BodyID[] = []
let hasInitializedBodies = false

$effect(() => {
	if (!$isReady || !$bodyInterface || !floorMesh || hasInitializedBodies) return
	if (sphereMeshes.some((mesh) => mesh === undefined)) return

	createFloorBody($bodyInterface, floorMesh)

	const readySphereMeshes = sphereMeshes.filter((mesh): mesh is THREE.Mesh => mesh !== undefined)
	readySphereMeshes.forEach((mesh, index) => {
		createSphereBody($bodyInterface, mesh, sphereConfigs[index])
	})

	dynamicObjects.set(readySphereMeshes)
	hasInitializedBodies = true
})
```

Body creation pattern:

```ts
const shape = new JoltModule.SphereShape(radius)
const settings = new JoltModule.BodyCreationSettings(
	shape,
	new JoltModule.RVec3(x, y, z),
	JoltModule.Quat.prototype.sIdentity(),
	JoltModule.EMotionType_Dynamic,
	LAYER_MOVING
)
const body = bodyInterfaceRef.CreateBody(settings)
JoltModule.destroy(settings)
bodyInterfaceRef.AddBody(body.GetID(), JoltModule.EActivation_Activate)
mesh.userData.body = body
```

## 5. Step simulation in Threlte render loop

Use `useTask` to run every frame:

- clamp delta to avoid unstable large steps
- choose sub-steps when frame time drops
- step Jolt
- copy Jolt transform to Three mesh

```ts
useTask((delta) => {
	if (!$jolt) return

	const clampedDelta = Math.min(delta, 1.0 / 30.0)
	const numSteps = clampedDelta > 1.0 / 55.0 ? 2 : 1
	$jolt.Step(clampedDelta, numSteps)

	for (const mesh of $dynamicObjects) {
		const body = mesh.userData.body
		if (!body) continue
		mesh.position.copy(wrapVec3(body.GetPosition()))
		mesh.quaternion.copy(wrapQuat(body.GetRotation()))
	}
})
```

## 6. Cleanup bodies on component destroy

Always remove and destroy bodies when leaving the page:

```ts
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
```

## 7. Result

With this setup:

- Threlte handles rendering and scene graph
- Jolt handles simulation and collision
- `useTask` keeps Three meshes synchronized with Jolt bodies each frame

You can now add more body types (boxes/capsules/compound shapes), constraints, and interaction logic with the same pattern.
