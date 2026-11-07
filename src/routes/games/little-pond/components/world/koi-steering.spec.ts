import { describe, expect, it } from 'vitest'
import { createKoiState, steerKoi, type Food, type SteerWorld } from './koi-steering'
import { bottom } from './terrain'

function seeded(seed: number) {
	let s = seed
	return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

function makeWorld(n: number, rand: () => number, food: Food[] = []): SteerWorld {
	return {
		fishes: Array.from({ length: n }, () => createKoiState(0.5, rand)),
		food,
		obstacles: [],
		drop: () => {},
		rand,
	}
}

describe('steerKoi', () => {
	it('cá bơi mãi vẫn ở trong nước, dưới mặt nước', () => {
		const rand = seeded(11)
		const world = makeWorld(7, rand)
		for (let t = 0; t < 60 * 60; t++) {
			for (const f of world.fishes) {
				steerKoi(f, world, 1 / 60)
				expect(bottom(f.pos.x, f.pos.z)).toBeLessThan(0)
				expect(f.pos.y).toBeLessThan(0)
			}
		}
	})

	it('cá tìm tới và ăn hết thức ăn gần đó', () => {
		const rand = seeded(5)
		const food: Food[] = [{ x: 0.3, z: 0.2, vx: 0, vz: 0 }]
		const world = makeWorld(1, rand, food)
		let drops = 0
		world.drop = () => drops++
		for (let t = 0; t < 60 * 30 && food.length; t++) steerKoi(world.fishes[0], world, 1 / 60)
		expect(food).toHaveLength(0)
		expect(drops).toBeGreaterThan(0)
	})
})
