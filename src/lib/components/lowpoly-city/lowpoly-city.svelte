<script lang="ts">
	import { T } from '@threlte/core'
	import { OrbitControls } from '@threlte/extras'

	type CommonPrimitiveProps = {
		id: string
		position: [number, number, number]
		rotation: [number, number, number]
		color: string
		metalness?: number
		roughness?: number
	}

	type BoxPrimitive = CommonPrimitiveProps & {
		kind: 'box'
		args: { width: number; height: number; depth: number }
	}

	type CylinderPrimitive = CommonPrimitiveProps & {
		kind: 'cylinder'
		args: { radiusTop: number; radiusBottom: number; height: number; radialSegments: number }
	}

	type ConePrimitive = CommonPrimitiveProps & {
		kind: 'cone'
		args: { radius: number; height: number; radialSegments: number }
	}

	type SpherePrimitive = CommonPrimitiveProps & {
		kind: 'sphere'
		args: { radius: number; widthSegments: number; heightSegments: number }
	}

	type ScenePrimitive = BoxPrimitive | CylinderPrimitive | ConePrimitive | SpherePrimitive

	// Seeded PRNG so the "random" city is stable across reloads (and SSR-safe).
	function mulberry32(seed: number) {
		return () => {
			let t = (seed += 0x6d2b79f5)
			t = Math.imul(t ^ (t >>> 15), t | 1)
			t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296
		}
	}

	function clamp(value: number, min: number, max: number) {
		return Math.min(max, Math.max(min, value))
	}

	function createCity(seed: number): ScenePrimitive[] {
		const rng = mulberry32(seed)

		const palette = [
			'#BFC4C8', // concrete
			'#9AA3A9', // steel grey
			'#D7D0C3', // warm stone
			'#C7B299', // sand
			'#8E99A2', // slate
			'#4A90E2', // glass accent
			'#FF6B6B', // accent
		]

		const pick = <TValue,>(values: TValue[]) => values[Math.floor(rng() * values.length)]
		const range = (min: number, max: number) => min + (max - min) * rng()
		const chance = (p: number) => rng() < p

		const primitives: ScenePrimitive[] = []

		const gridSize = 7
		const spacing = 2.4
		const half = (gridSize - 1) / 2

		for (let gx = 0; gx < gridSize; gx++) {
			for (let gz = 0; gz < gridSize; gz++) {
				// Leave some empty lots so it reads more like a city block.
				if (!chance(0.75)) continue

				const x = (gx - half) * spacing + range(-0.6, 0.6)
				const z = (gz - half) * spacing + range(-0.6, 0.6)

				// Mostly "building-like" proportions: tall-ish with smaller footprints.
				const kind: ScenePrimitive['kind'] = pick([
					'box',
					'box',
					'box',
					'cylinder',
					'cylinder',
					'cone',
					'sphere',
				])

				const rotationY = range(0, Math.PI * 2)
				const baseColor = pick(palette)

				if (kind === 'box') {
					const width = range(0.6, 1.8)
					const depth = range(0.6, 1.8)
					const height = range(0.9, 6.5)
					primitives.push({
						id: `box-${gx}-${gz}`,
						kind,
						position: [x, height / 2, z],
						rotation: [0, rotationY, 0],
						color: baseColor,
						roughness: 0.9,
						args: { width, height, depth },
					})
					continue
				}

				if (kind === 'cylinder') {
					const radius = range(0.35, 0.9)
					const height = range(1.2, 7.5)
					primitives.push({
						id: `cyl-${gx}-${gz}`,
						kind,
						position: [x, height / 2, z],
						rotation: [0, rotationY, 0],
						color: baseColor,
						roughness: 0.85,
						args: { radiusTop: radius, radiusBottom: radius, height, radialSegments: 18 },
					})
					continue
				}

				if (kind === 'cone') {
					const radius = range(0.5, 1.2)
					const height = range(1.0, 4.2)
					primitives.push({
						id: `cone-${gx}-${gz}`,
						kind,
						position: [x, height / 2, z],
						rotation: [0, rotationY, 0],
						color: baseColor,
						roughness: 0.95,
						args: { radius, height, radialSegments: 16 },
					})
					continue
				}

				// Sphere: reads as tanks / domes / sculptures.
				const radius = range(0.25, 0.75)
				const y = radius
				primitives.push({
					id: `sphere-${gx}-${gz}`,
					kind,
					position: [x, y, z],
					rotation: [0, 0, 0],
					color: baseColor,
					metalness: clamp(range(-0.1, 0.5), 0, 1),
					roughness: clamp(range(0.2, 1.0), 0, 1),
					args: { radius, widthSegments: 18, heightSegments: 12 },
				})
			}
		}

		// A few extra accent spheres scattered around as "street lights" / markers.
		for (let i = 0; i < 10; i++) {
			const radius = range(0.08, 0.18)
			primitives.push({
				id: `marker-${i}`,
				kind: 'sphere',
				position: [range(-8.5, 8.5), radius, range(-8.5, 8.5)],
				rotation: [0, 0, 0],
				color: pick(['#FFD166', '#06D6A0', '#EF476F', '#118AB2']),
				metalness: 0.8,
				roughness: 0.25,
				args: { radius, widthSegments: 16, heightSegments: 12 },
			})
		}

		return primitives
	}

	const primitives = createCity(1337)
</script>

<!-- Camera -->
<T.PerspectiveCamera
	makeDefault
	position={[10, 8, 10]}
	oncreate={(ref) => {
		ref.lookAt(0, 2, 0)
	}}
>
	<!-- Interactive camera controls (rotate / pan / zoom) -->
	<OrbitControls enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI / 2 - 0.05} />
</T.PerspectiveCamera>

<!-- Lighting -->
<T.AmbientLight intensity={0.4} />
<T.DirectionalLight position={[5, 10, 5]} intensity={0.8} castShadow />
<T.DirectionalLight position={[-5, 5, -5]} intensity={0.3} />

<!-- Ground Plane -->
<T.Mesh rotation.x={-Math.PI / 2} position.y={0} receiveShadow>
	<T.PlaneGeometry args={[1000, 1000]} />
	<T.MeshStandardMaterial color="#8B7355" />
</T.Mesh>

{#each primitives as primitive (primitive.id)}
	<T.Mesh position={primitive.position} rotation={primitive.rotation} castShadow receiveShadow>
		{#if primitive.kind === 'box'}
			<T.BoxGeometry args={[primitive.args.width, primitive.args.height, primitive.args.depth]} />
		{:else if primitive.kind === 'cylinder'}
			<T.CylinderGeometry
				args={[
					primitive.args.radiusTop,
					primitive.args.radiusBottom,
					primitive.args.height,
					primitive.args.radialSegments,
				]}
			/>
		{:else if primitive.kind === 'cone'}
			<T.ConeGeometry
				args={[primitive.args.radius, primitive.args.height, primitive.args.radialSegments]}
			/>
		{:else}
			<T.SphereGeometry
				args={[primitive.args.radius, primitive.args.widthSegments, primitive.args.heightSegments]}
			/>
		{/if}

		<T.MeshStandardMaterial
			color={primitive.color}
			metalness={primitive.metalness ?? 0}
			roughness={primitive.roughness ?? 0.9}
		/>
	</T.Mesh>
{/each}
