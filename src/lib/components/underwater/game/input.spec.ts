import { describe, it, expect } from 'vitest'
import { inputFromKeys, attachInput } from './input'

describe('inputFromKeys', () => {
	it('maps WASD/QE to thrust, turn and rise', () => {
		expect(inputFromKeys(new Set(['KeyW', 'KeyA', 'KeyE']))).toEqual({
			thrust: 1,
			turn: 1,
			rise: 1,
		})
		expect(inputFromKeys(new Set(['KeyS', 'KeyD', 'KeyQ']))).toEqual({
			thrust: -1,
			turn: -1,
			rise: -1,
		})
	})
	it('cancels opposite keys and ignores unknown keys', () => {
		expect(inputFromKeys(new Set(['KeyW', 'KeyS', 'F5']))).toEqual({ thrust: 0, turn: 0, rise: 0 })
	})
})

describe('attachInput', () => {
	const setup = () => {
		const target = new EventTarget()
		const canvas = new EventTarget()
		const input = attachInput(target, canvas)
		const key = (type: string, code: string) =>
			target.dispatchEvent(Object.assign(new Event(type), { code }))
		return { target, input, key }
	}
	it('tracks held keys and releases them all when the window loses focus', () => {
		const { target, input, key } = setup()
		key('keydown', 'KeyW')
		key('keydown', 'KeyA')
		key('keyup', 'KeyA')
		expect([...input.keys]).toEqual(['KeyW'])
		target.dispatchEvent(new Event('blur'))
		expect(input.keys.size).toBe(0)
	})
	it('stops listening after dispose', () => {
		const { input, key } = setup()
		input.dispose()
		key('keydown', 'KeyW')
		expect(input.keys.size).toBe(0)
	})
})
