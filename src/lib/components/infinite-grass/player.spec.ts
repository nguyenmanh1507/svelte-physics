import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { PlayerBall } from './player'

const flat = () => 2 // mặt đất phẳng ở độ cao 2 m

describe('quả bóng nhân vật', () => {
	it('đi theo hướng và tốc độ, luôn nằm trên mặt đất', () => {
		const ball = new PlayerBall(0.5)
		ball.update(2, new THREE.Vector2(1, 0), 3, flat)
		expect(ball.position.x).toBeCloseTo(6)
		expect(ball.position.y).toBeCloseTo(2.5)
	})

	it('không ra ngoài giới hạn', () => {
		const ball = new PlayerBall()
		ball.bounds = 10
		ball.update(100, new THREE.Vector2(0, -1), 5, flat)
		expect(ball.position.z).toBe(-10)
	})

	it('lăn đúng chiều: đỉnh bóng chạy về phía trước', () => {
		const ball = new PlayerBall(1)
		// đi một phần tư vòng bóng về +x
		ball.update(1, new THREE.Vector2(1, 0), Math.PI / 2, flat)
		const top = new THREE.Vector3(0, 1, 0).applyQuaternion(ball.mesh.quaternion)
		expect(top.x).toBeCloseTo(1)
		expect(top.y).toBeCloseTo(0)
	})
})
