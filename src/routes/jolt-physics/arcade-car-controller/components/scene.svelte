<script lang="ts">
	import { T } from '@threlte/core'
	import { Environment, Gizmo, OrbitControls } from '@threlte/extras'

	import { Stats } from '$lib/components/stats'
	import { JoltWorld } from '$lib/hooks/use-jolt'
	import Ground from './ground.svelte'
	import Car from './car.svelte'
	import Taxi from './taxi.svelte'
</script>

<JoltWorld>
	<T.PerspectiveCamera makeDefault position={[0, 15, 30]} lookAt.y={0}>
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
