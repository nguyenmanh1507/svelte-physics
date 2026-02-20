<script lang="ts">
	import * as THREE from 'three'
	import { T } from '@threlte/core'
	import { Sky } from '@threlte/extras'
	import { JoltWorld } from '$lib/hooks/use-jolt'
	import FollowCamera from './follow-camera.svelte'
	import Ground from './ground.svelte'
	import Plane from './plane.svelte'
	import Trail from './trail.svelte'

	let planeTarget = $state<THREE.Object3D | undefined>(undefined)
	let trailData = $state<{
		tailPoint: THREE.Vector3 | null
		leftWingPoint: THREE.Vector3 | null
		rightWingPoint: THREE.Vector3 | null
		forwardSpeed: number
	}>({ tailPoint: null, leftWingPoint: null, rightWingPoint: null, forwardSpeed: 0 })
</script>

<JoltWorld>
	<Sky elevation={0.5} />

	<FollowCamera target={planeTarget} />

	<T.DirectionalLight
		position={[20, 25, 10]}
		castShadow
		intensity={1.1}
		shadow.camera.left={-50}
		shadow.camera.right={50}
		shadow.camera.top={50}
		shadow.camera.bottom={-50}
		shadow.camera.near={1}
		shadow.camera.far={100}
		shadow.mapSize={[2048, 2048]}
	/>
	<T.AmbientLight intensity={0.35} />

	<Plane
		bind:trailData
		onTargetReady={(target) => {
			planeTarget = target
		}}
	/>

	<Trail {trailData} />

	<Ground />
</JoltWorld>
