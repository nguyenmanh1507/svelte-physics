<script lang="ts">
	import { T } from '@threlte/core'
	import { useTexture } from '@threlte/extras'
	import * as THREE from 'three'
	import { JoltRigidBody } from '$lib/hooks/use-jolt'

	const floorTexturePath = '/images/prototype-texture/Green/texture_01.png'
	const floorTexture = useTexture(floorTexturePath)
	floorTexture.then((texture) => {
		texture.wrapS = THREE.RepeatWrapping
		texture.wrapT = THREE.RepeatWrapping
		texture.repeat.set(1000, 1000)
	})
</script>

{#await floorTexture then map}
	<JoltRigidBody
		shape={{ type: 'box', halfExtent: [50, 0.5, 50], convexRadius: 0.05 }}
		motionType="static"
		layer="nonMoving"
	>
		{#snippet children({ oncreate })}
			<T.Mesh position={[0, -0.5, 0]} receiveShadow {oncreate}>
				<T.BoxGeometry args={[10000, 1, 10000]} />
				<T.MeshStandardMaterial {map} />
			</T.Mesh>
		{/snippet}
	</JoltRigidBody>
{/await}
