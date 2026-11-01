import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { FlyControls } from './fly-controls'

function setup() {
	const camera = new THREE.PerspectiveCamera()
	camera.position.set(0, 30, 0)
	// chỉ cần addEventListener / tabIndex, không cần DOM thật
	const element = new EventTarget() as HTMLElement
	const controls = new FlyControls(camera, element)
	controls.pitch = 0
	return { camera, controls }
}

describe('camera bay tự do', () => {
	it('W tiến theo hướng nhìn, Shift bay nhanh hơn', () => {
		const { camera, controls } = setup()
		controls.keys.add('KeyW')
		controls.update(1)
		expect(camera.position.z).toBeCloseTo(-controls.speed)

		controls.keys.add('ShiftLeft')
		controls.update(1)
		expect(camera.position.z).toBeCloseTo(-controls.speed * 16)
	})

	it('E bay lên tới tầng mây, Q không xuyên xuống dưới mặt đất', () => {
		const { camera, controls } = setup()
		controls.keys.add('KeyE')
		controls.update(30)
		expect(camera.position.y).toBeCloseTo(30 + controls.speed * 30)

		controls.keys.clear()
		controls.keys.add('KeyQ')
		controls.update(1000)
		expect(camera.position.y).toBeCloseTo(1.7)
	})
})
