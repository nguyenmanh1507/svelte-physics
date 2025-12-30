import * as LJS from 'littlejsengine'

import { vec2 } from './constants'

class Ball extends LJS.EngineObject {
	constructor(pos: LJS.Vector2) {
		super(pos, vec2(0.5))
		this.velocity = vec2(-0.1, -0.1)
		this.setCollision()
	}
}

export { Ball }
