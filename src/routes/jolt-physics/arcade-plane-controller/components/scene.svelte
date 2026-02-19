<script lang="ts">
	import { T } from '@threlte/core'
	import { Gizmo, OrbitControls } from '@threlte/extras'
</script>

<T.PerspectiveCamera makeDefault position={[10, 7, 6]} lookAt.y={0}>
	<OrbitControls>
		<Gizmo />
	</OrbitControls>
</T.PerspectiveCamera>

<T.DirectionalLight position.y={10} position.z={10} />
<T.AmbientLight intensity={0.3} />
