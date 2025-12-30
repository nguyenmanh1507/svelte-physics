import * as LJS from 'littlejsengine'

import { levelSize, vec2 } from './constants'

class Paddle extends LJS.EngineObject {
	constructor() {
		super(vec2(0, 1), vec2(6, 0.5))

		this.setCollision()
		this.mass = 0
		this.restitution = 1
	}

	update(): void {
		this.pos.x = LJS.mousePos.x
		// Clamp the paddle to the level boundary
		this.pos.x = LJS.clamp(this.pos.x, this.size.x / 2, levelSize.x - this.size.x / 2)
	}
}

export { Paddle }
