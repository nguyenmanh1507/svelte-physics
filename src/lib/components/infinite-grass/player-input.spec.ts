import { describe, expect, it } from 'vitest'
import { moveDirection } from './player-input'

// camera nhìn về -z (mặc định của three.js)
const lookingNorth = { x: 0, z: -1 }

describe('hướng đi của nhân vật', () => {
	it('không giữ phím thì đứng yên', () => {
		expect(moveDirection(new Set(), lookingNorth).length()).toBe(0)
	})

	it('W đi theo hướng nhìn, D sang phải của hướng nhìn', () => {
		const w = moveDirection(new Set(['KeyW']), lookingNorth)
		expect(w.x).toBeCloseTo(0)
		expect(w.y).toBeCloseTo(-1) // y của Vector2 là trục z của thế giới

		const d = moveDirection(new Set(['KeyD']), lookingNorth)
		expect(d.x).toBeCloseTo(1)
		expect(d.y).toBeCloseTo(0)
	})

	it('đi chéo không nhanh hơn đi thẳng', () => {
		expect(moveDirection(new Set(['KeyW', 'KeyD']), lookingNorth).length()).toBeCloseTo(1)
	})

	it('xoay theo camera: nhìn về +x thì W đi về +x', () => {
		const w = moveDirection(new Set(['ArrowUp']), { x: 3, z: 0 })
		expect(w.x).toBeCloseTo(1)
		expect(w.y).toBeCloseTo(0)
	})
})
