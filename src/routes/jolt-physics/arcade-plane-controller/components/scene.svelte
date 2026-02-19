<script lang="ts">
	import { T } from '@threlte/core'
	import { Gizmo, OrbitControls, Sky } from '@threlte/extras'
	import Ground from './ground.svelte'
</script>

<Sky elevation={0.5} />

<T.PerspectiveCamera makeDefault position={[10, 7, 6]} lookAt.y={0}>
	<OrbitControls>
		<Gizmo />
	</OrbitControls>
</T.PerspectiveCamera>

<T.DirectionalLight position.y={10} position.z={10} />
<T.AmbientLight intensity={0.3} />

<Ground />
