<script lang="ts">
	import { T, useTask } from '@threlte/core'
	import { MeshLineGeometry, MeshLineMaterial } from '@threlte/extras'
	import * as THREE from 'three'

	type TrailData = {
		tailPoint: THREE.Vector3 | null
		leftWingPoint: THREE.Vector3 | null
		rightWingPoint: THREE.Vector3 | null
		forwardSpeed: number
	}

	type TimedPoint = {
		position: THREE.Vector3
		life: number
	}

	type SmokePuff = {
		id: number
		position: THREE.Vector3
		life: number
		maxLife: number
		size: number
	}

	type Props = {
		trailData: TrailData
	}

	let { trailData }: Props = $props()

	const MIN_SPEED_FOR_TRAIL = 5
	const TAIL_SMOKE_LIFETIME = 0.5
	const TAIL_SMOKE_EMIT_INTERVAL = 0.04
	const MAX_TAIL_SMOKE = 30
	const WING_TRAIL_LIFETIME = 0.6
	const WING_TRAIL_EMIT_INTERVAL = 0.04
	const MAX_WING_POINTS = 120

	let tailSmoke = $state<SmokePuff[]>([])
	let leftWingTrail = $state<TimedPoint[]>([])
	let rightWingTrail = $state<TimedPoint[]>([])
	let tailEmitAccumulator = 0
	let wingEmitAccumulator = 0
	let nextSmokeId = 1

	function createSmokeTexture(): THREE.Texture | null {
		if (typeof document === 'undefined') return null
		const size = 128
		const canvas = document.createElement('canvas')
		canvas.width = size
		canvas.height = size
		const ctx = canvas.getContext('2d')
		if (!ctx) return null
		const gradient = ctx.createRadialGradient(
			size * 0.5,
			size * 0.5,
			size * 0.1,
			size * 0.5,
			size * 0.5,
			size * 0.5
		)
		gradient.addColorStop(0, 'rgba(226, 232, 240, 0.9)')
		gradient.addColorStop(0.7, 'rgba(148, 163, 184, 0.4)')
		gradient.addColorStop(1, 'rgba(148, 163, 184, 0)')
		ctx.fillStyle = gradient
		ctx.fillRect(0, 0, size, size)

		const texture = new THREE.CanvasTexture(canvas)
		texture.needsUpdate = true
		return texture
	}

	const smokeTexture = createSmokeTexture()

	const leftWingPoints = $derived(leftWingTrail.map((p) => p.position))
	const rightWingPoints = $derived(rightWingTrail.map((p) => p.position))

	useTask('trail-effects', (delta) => {
		tailSmoke = tailSmoke.map((p) => ({ ...p, life: p.life - delta })).filter((p) => p.life > 0)

		leftWingTrail = leftWingTrail
			.map((p) => ({ ...p, life: p.life - delta }))
			.filter((p) => p.life > 0)
		rightWingTrail = rightWingTrail
			.map((p) => ({ ...p, life: p.life - delta }))
			.filter((p) => p.life > 0)

		if (trailData.forwardSpeed < MIN_SPEED_FOR_TRAIL) {
			return
		}

		if (trailData.tailPoint) {
			tailEmitAccumulator += delta
			if (tailEmitAccumulator >= TAIL_SMOKE_EMIT_INTERVAL && tailSmoke.length < MAX_TAIL_SMOKE) {
				tailEmitAccumulator = 0
				tailSmoke = [
					...tailSmoke,
					{
						id: nextSmokeId++,
						position: new THREE.Vector3(
							trailData.tailPoint.x,
							trailData.tailPoint.y,
							trailData.tailPoint.z
						),
						life: TAIL_SMOKE_LIFETIME,
						maxLife: TAIL_SMOKE_LIFETIME,
						size: 0.22 + Math.random() * 0.08,
					},
				]
			}
		}

		wingEmitAccumulator += delta
		if (wingEmitAccumulator < WING_TRAIL_EMIT_INTERVAL) {
			return
		}
		wingEmitAccumulator = 0

		if (trailData.leftWingPoint) {
			const next = [
				...leftWingTrail,
				{
					position: new THREE.Vector3(
						trailData.leftWingPoint.x,
						trailData.leftWingPoint.y,
						trailData.leftWingPoint.z
					),
					life: WING_TRAIL_LIFETIME,
				},
			]
			leftWingTrail =
				next.length > MAX_WING_POINTS ? next.slice(next.length - MAX_WING_POINTS) : next
		}

		if (trailData.rightWingPoint) {
			const next = [
				...rightWingTrail,
				{
					position: new THREE.Vector3(
						trailData.rightWingPoint.x,
						trailData.rightWingPoint.y,
						trailData.rightWingPoint.z
					),
					life: WING_TRAIL_LIFETIME,
				},
			]
			rightWingTrail =
				next.length > MAX_WING_POINTS ? next.slice(next.length - MAX_WING_POINTS) : next
		}
	})
</script>

{#if leftWingPoints.length >= 2}
	<T.Mesh renderOrder={1}>
		<MeshLineGeometry points={leftWingPoints} shape="taper" />
		<MeshLineMaterial width={0.03} color="#bfdbfe" opacity={0.45} attenuate transparent />
	</T.Mesh>
{/if}

{#if rightWingPoints.length >= 2}
	<T.Mesh renderOrder={1}>
		<MeshLineGeometry points={rightWingPoints} shape="taper" />
		<MeshLineMaterial width={0.03} color="#bfdbfe" opacity={0.45} attenuate transparent />
	</T.Mesh>
{/if}

{#each tailSmoke as puff (puff.id)}
	<T.Sprite
		position={[puff.position.x, puff.position.y, puff.position.z]}
		scale={[
			puff.size * (1 + (1 - puff.life / puff.maxLife) * 0.9),
			puff.size * (1 + (1 - puff.life / puff.maxLife) * 0.9),
			1,
		]}
		renderOrder={2}
	>
		<T.SpriteMaterial
			map={smokeTexture ?? undefined}
			color="#cbd5e1"
			transparent
			opacity={0.6 * (puff.life / puff.maxLife)}
			depthWrite={false}
		/>
	</T.Sprite>
{/each}
