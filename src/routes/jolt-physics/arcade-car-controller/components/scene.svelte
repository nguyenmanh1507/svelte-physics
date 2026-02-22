<script lang="ts">
	import { T, useThrelte } from '@threlte/core'
	import { Environment, Gizmo, OrbitControls } from '@threlte/extras'

	import { Stats } from '$lib/components/stats'
	import { JoltWorld } from '$lib/hooks/use-jolt'
	// import { CameraLogger } from '$lib/components/camera-logger'
	import Ground from './ground.svelte'
	import Car from './car.svelte'
	import Taxi from './taxi.svelte'

	const { scene } = useThrelte()
	scene.backgroundBlurriness = 0.4
</script>

<JoltWorld>
	<T.PerspectiveCamera
		makeDefault
		position={[0.02, 4.5, 10]}
		rotation={[0, 0, 0]}
		fov={50}
		near={0.1}
		far={2000}
		oncreate={(ref) => {
			ref.lookAt(0, 2, 0)
		}}
	>
		<OrbitControls>
			<Gizmo />
		</OrbitControls>
	</T.PerspectiveCamera>

	<Environment url="/images/bryanston_park_sunrise_1k.hdr" isBackground />

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
	<!-- <T.AmbientLight intensity={0.35} /> -->

	<Car />
	<Taxi />

	<Ground />
</JoltWorld>

<Stats />

<!-- <CameraLogger /> -->
