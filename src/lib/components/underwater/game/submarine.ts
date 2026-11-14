// Motion model of the toy submarine: a pure function of state, input and environment.
import { PLAY_HALF } from './terrain'

export interface SubState {
	x: number
	y: number
	z: number
	/** heading in radians: the bow points along (sin yaw, 0, cos yaw) */
	yaw: number
	/** signed speed along the heading, m/s */
	speed: number
	/** vertical speed, m/s */
	vy: number
}

/** each value in [-1, 1] */
export interface SubInput {
	thrust: number
	turn: number
	rise: number
}

/** seabed elevation and water surface height at the submarine's (x, z) */
export interface SubEnv {
	floor: number
	surface: number
}

export const SUB = {
	maxSpeed: 1.5,
	maxRise: 0.8,
	turnRate: 1.2,
	accelTau: 0.8,
	/** the hull centre stays this far above the seabed */
	floorGap: 0.25,
	/** highest hull centre relative to the water surface: 0 = half the hull out of the water */
	surfaceOffset: 0,
}

export function initialSub(): SubState {
	return { x: 0, y: -1, z: 0, yaw: 0, speed: 0, vy: 0 }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function stepSub(s: SubState, input: SubInput, env: SubEnv, dt: number): SubState {
	const blend = 1 - Math.exp(-dt / SUB.accelTau)
	let speed = s.speed + (clamp(input.thrust, -1, 1) * SUB.maxSpeed - s.speed) * blend
	let vy = s.vy + (clamp(input.rise, -1, 1) * SUB.maxRise - s.vy) * blend
	const yaw = s.yaw + clamp(input.turn, -1, 1) * SUB.turnRate * dt

	const wantX = s.x + Math.sin(yaw) * speed * dt
	const wantZ = s.z + Math.cos(yaw) * speed * dt
	const x = clamp(wantX, -PLAY_HALF, PLAY_HALF)
	const z = clamp(wantZ, -PLAY_HALF, PLAY_HALF)
	if (x !== wantX || z !== wantZ) speed = 0

	// the seabed wins when the water is too shallow for both limits
	const minY = env.floor + SUB.floorGap
	const maxY = Math.max(minY, env.surface + SUB.surfaceOffset)
	const wantY = s.y + vy * dt
	const y = clamp(wantY, minY, maxY)
	if (y !== wantY) vy = 0

	return { x, y, z, yaw, speed, vy }
}
