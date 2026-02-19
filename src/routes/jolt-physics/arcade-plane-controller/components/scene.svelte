<script lang="ts">
	import * as THREE from 'three'
	import { T, useTask, useThrelte } from '@threlte/core'
	import { Gizmo, OrbitControls } from '@threlte/extras'
	import initJolt from 'jolt-physics'
	import type JoltType from 'jolt-physics/wasm-compat'

	import { useJolt, wrapVec3, wrapQuat } from '$lib/hooks/use-jolt'
</script>

<T.PerspectiveCamera makeDefault position={[10, 7, 6]} lookAt.y={0}>
	<OrbitControls>
		<Gizmo />
	</OrbitControls>
</T.PerspectiveCamera>

<T.DirectionalLight position.y={10} position.z={10} />
<T.AmbientLight intensity={0.3} />
