import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import {
	DEFAULT_PLANE_CONTROLLER_CONFIG,
	createInitialPlaneState,
	readPlaneInput,
	stepPlaneController,
} from './plane-controller'

function setAngles(state: ReturnType<typeof createInitialPlaneState>, pitch: number, yaw: number) {
	state.pitch = pitch
	state.yaw = yaw
	state.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'))
}

describe('plane controller', () => {
	it('throttle up clamps to maxFlightSpeed', () => {
		const state = createInitialPlaneState(DEFAULT_PLANE_CONTROLLER_CONFIG)
		state.forwardSpeed = DEFAULT_PLANE_CONTROLLER_CONFIG.maxFlightSpeed - 1

		const input = readPlaneInput(
			new Set(['ShiftLeft']),
			state,
			1,
			DEFAULT_PLANE_CONTROLLER_CONFIG
		)
		expect(input.targetSpeed).toBe(DEFAULT_PLANE_CONTROLLER_CONFIG.maxFlightSpeed)
	})

	it('airborne throttle down cannot drop below minFlightSpeed', () => {
		const state = createInitialPlaneState(DEFAULT_PLANE_CONTROLLER_CONFIG)
		state.grounded = false
		state.forwardSpeed = DEFAULT_PLANE_CONTROLLER_CONFIG.minFlightSpeed + 2

		const input = readPlaneInput(
			new Set(['ControlLeft']),
			state,
			1,
			DEFAULT_PLANE_CONTROLLER_CONFIG
		)
		expect(input.targetSpeed).toBe(DEFAULT_PLANE_CONTROLLER_CONFIG.minFlightSpeed)
	})

	it('grounded throttle down can reach 0', () => {
		const state = createInitialPlaneState(DEFAULT_PLANE_CONTROLLER_CONFIG)
		state.grounded = true
		state.forwardSpeed = 6

		const input = readPlaneInput(
			new Set(['ControlLeft']),
			state,
			1,
			DEFAULT_PLANE_CONTROLLER_CONFIG
		)
		expect(input.targetSpeed).toBe(0)
	})

	it('pitch-up is ignored below minFlightSpeed', () => {
		const state = createInitialPlaneState(DEFAULT_PLANE_CONTROLLER_CONFIG)
		state.grounded = false
		state.forwardSpeed = DEFAULT_PLANE_CONTROLLER_CONFIG.minFlightSpeed - 0.1

		const input = readPlaneInput(new Set(['KeyS']), state, 0.2, DEFAULT_PLANE_CONTROLLER_CONFIG)
		expect(input.pitchInput).toBe(0)
	})

	it('pitch-down is ignored while grounded', () => {
		const state = createInitialPlaneState(DEFAULT_PLANE_CONTROLLER_CONFIG)
		state.grounded = true
		state.forwardSpeed = 20

		const input = readPlaneInput(new Set(['KeyW']), state, 0.2, DEFAULT_PLANE_CONTROLLER_CONFIG)
		expect(input.pitchInput).toBe(0)
	})

	it('bank roll lerps toward 0 when grounded', () => {
		const state = createInitialPlaneState(DEFAULT_PLANE_CONTROLLER_CONFIG)
		state.grounded = true
		state.forwardSpeed = 15
		state.bankAngle = 0.5

		const input = readPlaneInput(new Set(['KeyA']), state, 0.1, DEFAULT_PLANE_CONTROLLER_CONFIG)
		const result = stepPlaneController(state, input, 0.1, DEFAULT_PLANE_CONTROLLER_CONFIG)

		expect(result.bankAngle).toBeLessThan(0.5)
		expect(result.bankAngle).toBeGreaterThan(0)
	})

	it('touchdown resets pitch to 0', () => {
		const state = createInitialPlaneState(DEFAULT_PLANE_CONTROLLER_CONFIG)
		state.grounded = false
		state.forwardSpeed = 12
		state.targetSpeed = 12
		state.position.set(0, 0.36, 0)
		setAngles(state, -0.6, 0)

		const input = readPlaneInput(new Set(), state, 0.2, DEFAULT_PLANE_CONTROLLER_CONFIG)
		const result = stepPlaneController(state, input, 0.2, DEFAULT_PLANE_CONTROLLER_CONFIG)

		expect(result.grounded).toBe(true)
		expect(result.nextState.pitch).toBe(0)
		expect(result.nextState.position.y).toBe(
			DEFAULT_PLANE_CONTROLLER_CONFIG.groundHeight + DEFAULT_PLANE_CONTROLLER_CONFIG.groundClearance
		)
	})

	it('forward displacement follows forward axis with expected speed lerp', () => {
		const state = createInitialPlaneState(DEFAULT_PLANE_CONTROLLER_CONFIG)
		state.grounded = false
		state.position.set(0, 10, 0)
		state.forwardSpeed = 0
		state.targetSpeed = 0
		setAngles(state, 0, 0)

		const result = stepPlaneController(
			state,
			{ targetSpeed: 10, turnInput: 0, pitchInput: 0 },
			0.1,
			DEFAULT_PLANE_CONTROLLER_CONFIG
		)

		expect(result.forwardSpeed).toBeCloseTo(6, 5)
		expect(result.position.z).toBeCloseTo(-0.6, 5)
		expect(result.position.x).toBeCloseTo(0, 5)
	})
})
