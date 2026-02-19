# Integrate Jolt Physics with Threlte (Composable API)

This guide follows the new composition-first API in:

- `src/lib/hooks/use-jolt/JoltWorld.svelte`
- `src/lib/hooks/use-jolt/JoltRigidBody.svelte`
- `src/lib/hooks/use-jolt/useRigidBody.ts`
- `src/routes/jolt-physics/integrate-to-threlte/components/scene.svelte`

## 1. Install dependencies

```bash
pnpm add jolt-physics three @threlte/core @threlte/extras
```

## 2. Use `JoltWorld` as physics provider

`JoltWorld` is responsible for:

- initializing Jolt (`jolt-physics/wasm-compat`)
- configuring collision filtering
- stepping the simulation each frame
- syncing registered body transforms to Three.js meshes
- destroying all created bodies on unmount

Default stepping behavior:

- `maxDelta = 1/30`
- `subStepThreshold = 1/55`
- `slowFrameSubSteps = 2`
- `normalSubSteps = 1`
- `autoStep = true`

## 3. Attach bodies declaratively with `JoltRigidBody`

`JoltRigidBody` is a headless component that exposes `oncreate` via slot props.

You pass `shape` + body options, then apply `{oncreate}` to your `<T.Mesh>`.

```svelte
<JoltRigidBody
	shape={{ type: 'sphere', radius: 0.8 }}
	motionType="dynamic"
	layer="moving"
	position={[0, 12, 0]}
	restitution={0.5}
	let:oncreate
>
	<T.Mesh {oncreate}>
		<T.SphereGeometry args={[0.8, 32, 32]} />
		<T.MeshStandardMaterial color="#ff6b6b" />
	</T.Mesh>
</JoltRigidBody>
```

Supported shape options (first pass):

- `{ type: 'sphere', radius }`
- `{ type: 'box', halfExtent: [x, y, z], convexRadius? }`

## 4. Route-level structure

Your page remains a thin canvas wrapper:

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

In `scene.svelte`, wrap physics content in `JoltWorld`:

```svelte
<JoltWorld>
	<!-- camera, lights, meshes -->
</JoltWorld>
```

## 5. Full pattern (floor + dynamic spheres)

```svelte
<JoltWorld>
	<JoltRigidBody
		shape={{ type: 'box', halfExtent: [50, 0.5, 50], convexRadius: 0.05 }}
		motionType="static"
		layer="nonMoving"
		let:oncreate
	>
		<T.Mesh position={[0, -0.5, 0]} receiveShadow {oncreate}>
			<T.BoxGeometry args={[100, 1, 100]} />
			<T.MeshStandardMaterial color="#c7c7c7" />
		</T.Mesh>
	</JoltRigidBody>

	{#each spheres as sphere (sphere.id)}
		<JoltRigidBody
			shape={{ type: 'sphere', radius: sphere.radius }}
			motionType="dynamic"
			layer="moving"
			position={sphere.position}
			restitution={0.5}
			let:oncreate
		>
			<T.Mesh position={sphere.position} castShadow {oncreate}>
				<T.SphereGeometry args={[sphere.radius, 32, 32]} />
				<T.MeshStandardMaterial color={sphere.color} />
			</T.Mesh>
		</JoltRigidBody>
	{/each}
</JoltWorld>
```

## 6. Advanced: hook-only usage

For custom behavior, use `useRigidBody` directly:

```ts
import { useRigidBody } from '$lib/hooks/use-jolt'

const rigidBody = useRigidBody({
	shape: { type: 'sphere', radius: 1 },
	motionType: 'dynamic',
	position: [0, 8, 0],
})
```

Then attach to mesh:

```svelte
<T.Mesh oncreate={rigidBody.oncreate}>...</T.Mesh>
```

`useRigidBody` handles:

- delayed creation until world is ready + mesh exists
- auto registration for transform sync (non-static bodies)
- automatic cleanup on component destroy

## 7. Export surface

Use the API from:

```ts
import { JoltWorld, JoltRigidBody, useJoltWorld, useRigidBody } from '$lib/hooks/use-jolt'
```
