import * as THREE from 'three'

export type PlaneControllerConfig = {
	minFlightSpeed: number
	maxFlightSpeed: number
	turnSpeed: number
	pitchSpeed: number
	levelSpeed: number
	throttleDelta: number
	acceleration: number
	groundHeight: number
	groundClearance: number
	maxBankRadians: number
}

export type PlaneControllerState = {
	position: THREE.Vector3
	quaternion: THREE.Quaternion
	yaw: number
	pitch: number
	forwardSpeed: number
	targetSpeed: number
	grounded: boolean
	turnInput: number
	pitchInput: number
	velocity: THREE.Vector3
	bankAngle: number
}

export type PlaneInputState = {
	targetSpeed: number
	turnInput: number
	pitchInput: number
}

export type PlaneStepResult = {
	nextState: PlaneControllerState
	position: THREE.Vector3
	quaternion: THREE.Quaternion
	forwardSpeed: number
	targetSpeed: number
	grounded: boolean
	bankAngle: number
}

export const DEFAULT_PLANE_CONTROLLER_CONFIG: PlaneControllerConfig = {
	minFlightSpeed: 10,
	maxFlightSpeed: 30,
	turnSpeed: 0.75,
	pitchSpeed: 0.5,
	levelSpeed: 3.0,
	throttleDelta: 30,
	acceleration: 6.0,
	groundHeight: 0,
	groundClearance: 0.35,
	maxBankRadians: 0.7,
}

export const LIGHT_FIGHTER_CONTROLLER_CONFIG: PlaneControllerConfig = {
	...DEFAULT_PLANE_CONTROLLER_CONFIG,
	minFlightSpeed: 15,
	maxFlightSpeed: 45,
	turnSpeed: 1.2,
	pitchSpeed: 0.8,
	acceleration: 10,
	maxBankRadians: 1.0,
}

export const CARGO_CONTROLLER_CONFIG: PlaneControllerConfig = {
	...DEFAULT_PLANE_CONTROLLER_CONFIG,
	minFlightSpeed: 8,
	maxFlightSpeed: 22,
	turnSpeed: 0.4,
	pitchSpeed: 0.3,
	acceleration: 3,
	maxBankRadians: 0.5,
}

export const STUNT_CONTROLLER_CONFIG: PlaneControllerConfig = {
	...DEFAULT_PLANE_CONTROLLER_CONFIG,
	minFlightSpeed: 12,
	maxFlightSpeed: 35,
	turnSpeed: 1.0,
	pitchSpeed: 0.7,
	acceleration: 8,
	maxBankRadians: 1.2,
}

export const GLIDER_CONTROLLER_CONFIG: PlaneControllerConfig = {
	...DEFAULT_PLANE_CONTROLLER_CONFIG,
	minFlightSpeed: 5,
	maxFlightSpeed: 18,
	turnSpeed: 0.5,
	pitchSpeed: 0.4,
	acceleration: 2,
	maxBankRadians: 0.6,
}

const FORWARD_AXIS = new THREE.Vector3(0, 0, -1)

export function clamp(value: number, min: number, max: number) {
	return Math.max(min, Math.min(max, value))
}

export function lerp(from: number, to: number, alpha: number) {
	return from + (to - from) * clamp(alpha, 0, 1)
}

function composeQuaternion(pitch: number, yaw: number) {
	return new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'))
}

function getForwardDirection(quaternion: THREE.Quaternion) {
	return FORWARD_AXIS.clone().applyQuaternion(quaternion).normalize()
}

function isPressed(keys: ReadonlySet<string>, codes: readonly string[]) {
	return codes.some((code) => keys.has(code))
}

export function createInitialPlaneState(
	config: PlaneControllerConfig = DEFAULT_PLANE_CONTROLLER_CONFIG
): PlaneControllerState {
	const position = new THREE.Vector3(0, config.groundHeight + config.groundClearance, 0)
	const yaw = 0
	const pitch = 0
	const quaternion = composeQuaternion(pitch, yaw)

	return {
		position,
		quaternion,
		yaw,
		pitch,
		forwardSpeed: 0,
		targetSpeed: 0,
		grounded: true,
		turnInput: 0,
		pitchInput: 0,
		velocity: new THREE.Vector3(),
		bankAngle: 0,
	}
}

export function readPlaneInput(
	keys: ReadonlySet<string>,
	state: PlaneControllerState,
	delta: number,
	config: PlaneControllerConfig = DEFAULT_PLANE_CONTROLLER_CONFIG
): PlaneInputState {
	let targetSpeed = state.targetSpeed
	const throttleDelta = config.throttleDelta * delta

	if (isPressed(keys, ['ShiftLeft', 'ShiftRight'])) {
		targetSpeed = Math.min(state.forwardSpeed + throttleDelta, config.maxFlightSpeed)
	}

	if (isPressed(keys, ['ControlLeft', 'ControlRight'])) {
		const limit = state.grounded ? 0 : config.minFlightSpeed
		targetSpeed = Math.max(state.forwardSpeed - throttleDelta, limit)
	}

	let turnInput = 0
	if (state.forwardSpeed > 0.5) {
		if (keys.has('KeyA')) turnInput += 1
		if (keys.has('KeyD')) turnInput -= 1
	}

	let pitchInput = 0
	if (!state.grounded && keys.has('KeyW')) {
		pitchInput -= 1
	}
	if (state.forwardSpeed >= config.minFlightSpeed && keys.has('KeyS')) {
		pitchInput += 1
	}

	return {
		targetSpeed,
		turnInput: clamp(turnInput, -1, 1),
		pitchInput: clamp(pitchInput, -1, 1),
	}
}

export function stepPlaneController(
	state: PlaneControllerState,
	input: PlaneInputState,
	delta: number,
	config: PlaneControllerConfig = DEFAULT_PLANE_CONTROLLER_CONFIG
): PlaneStepResult {
	const safeDelta = Math.max(0, delta)

	let nextPitch = state.pitch + input.pitchInput * config.pitchSpeed * safeDelta
	const nextYaw = state.yaw + input.turnInput * config.turnSpeed * safeDelta
	let nextQuaternion = composeQuaternion(nextPitch, nextYaw)

	const forwardSpeed = lerp(
		state.forwardSpeed,
		clamp(input.targetSpeed, 0, config.maxFlightSpeed),
		config.acceleration * safeDelta
	)
	const forwardDirection = getForwardDirection(nextQuaternion)
	const velocity = forwardDirection.multiplyScalar(forwardSpeed)
	const position = state.position.clone().addScaledVector(velocity, safeDelta)

	const groundY = config.groundHeight + config.groundClearance
	let grounded = position.y <= groundY
	const justLanded = !state.grounded && grounded

	if (grounded) {
		position.y = groundY

		if (justLanded) {
			nextPitch = 0
			nextQuaternion = composeQuaternion(nextPitch, nextYaw)
			velocity.copy(getForwardDirection(nextQuaternion).multiplyScalar(forwardSpeed))
		}

		velocity.y = -1
	} else {
		grounded = false
	}

	const bankTarget = grounded ? 0 : input.turnInput * config.maxBankRadians
	const bankAngle = lerp(state.bankAngle, bankTarget, config.levelSpeed * safeDelta)

	const nextState: PlaneControllerState = {
		position,
		quaternion: nextQuaternion,
		yaw: nextYaw,
		pitch: nextPitch,
		forwardSpeed,
		targetSpeed: clamp(input.targetSpeed, 0, config.maxFlightSpeed),
		grounded,
		turnInput: input.turnInput,
		pitchInput: input.pitchInput,
		velocity,
		bankAngle,
	}

	return {
		nextState,
		position,
		quaternion: nextQuaternion,
		forwardSpeed,
		targetSpeed: nextState.targetSpeed,
		grounded,
		bankAngle,
	}
}
