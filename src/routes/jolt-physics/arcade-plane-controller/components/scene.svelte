<script lang="ts">
	import * as THREE from 'three'
	import { T } from '@threlte/core'
	import { Sky } from '@threlte/extras'
	import { JoltWorld } from '$lib/hooks/use-jolt'
	import FollowCamera from './follow-camera.svelte'
	import Ground from './ground.svelte'
	import Plane from './plane.svelte'

	let planeTarget = $state<THREE.Object3D | undefined>(undefined)
</script>

<JoltWorld>
	<Sky elevation={0.5} />

	<FollowCamera target={planeTarget} />

	<T.DirectionalLight position={[20, 25, 10]} castShadow intensity={1.1} shadow.mapSize={[2048, 2048]} />
	<T.AmbientLight intensity={0.35} />

	<Plane
		onTargetReady={(target) => {
			planeTarget = target
		}}
	/>

	<Ground />
</JoltWorld>
