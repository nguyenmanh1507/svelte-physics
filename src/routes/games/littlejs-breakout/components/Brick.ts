import * as LJS from 'littlejsengine'

class Brick extends LJS.EngineObject {
	constructor(pos: LJS.Vector2, size: LJS.Vector2) {
		super(pos, size)

		this.setCollision()
		this.mass = 0
		this.restitution = 1
	}

	collideWithObject() {
		this.destroy()
		return true
	}
}

export { Brick }
