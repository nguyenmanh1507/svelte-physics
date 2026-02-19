<script lang="ts">
	import { T } from '@threlte/core'
	import { useTexture } from '@threlte/extras'
	import * as THREE from 'three'

	const floorTexturePath = '/images/prototype-texture/Dark/texture_01.png'
	const floorTexture = useTexture(floorTexturePath)
	floorTexture.then((texture) => {
		texture.wrapS = THREE.RepeatWrapping
		texture.wrapT = THREE.RepeatWrapping
		texture.repeat.set(25, 25)
	})
</script>

{#await floorTexture then map}
	<T.Mesh position={[0, -0.5, 0]} receiveShadow>
		<T.BoxGeometry args={[100, 1, 100]} />
		<T.MeshStandardMaterial {map} />
	</T.Mesh>
{/await}
