<script lang="ts">
	import type { Snippet } from 'svelte'
	import type * as THREE from 'three'
	import { useRigidBody } from './useRigidBody'
	import type { RigidBodyOptions } from './types'

	type RigidBodyProps = RigidBodyOptions & {
		children: Snippet<[{ oncreate: (target: THREE.Object3D) => void }]>
	}

	let props: RigidBodyProps = $props()

	const { oncreate } = useRigidBody(() => props)
</script>

{@render props.children({ oncreate })}
