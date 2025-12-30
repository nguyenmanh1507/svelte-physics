import * as LJS from 'littlejsengine'

import { rgb } from './constants'

class Wall extends LJS.EngineObject {
	constructor(pos: LJS.Vector2, size: LJS.Vector2) {
		super(pos, size)

		this.setCollision()
		this.mass = 0
		this.restitution = 1
		this.color = rgb(0, 0, 0, 0)
	}
}

export { Wall }
