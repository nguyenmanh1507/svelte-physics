import * as LJS from 'littlejsengine'

import { Paddle } from './Paddle'
import { levelSize, vec2, rgb } from './constants'
import { Ball } from './Ball'
import { Wall } from './Wall'
import { Brick } from './Brick'

export function initGame(canvasContainer: HTMLDivElement) {
	LJS.setCanvasFixedSize(vec2(1280, 720))

	let ball: Ball

	/**
	 * SECTION: Game Initialization
	 * called once after the engine starts up
	 * setup the game
	 */
	function gameInit() {
		for (let x = 2; x <= levelSize.x - 2; x += 2) {
			for (let y = 12; y <= levelSize.y - 2; y += 1) {
				// Create a brick
				const brick = new Brick(vec2(x, y), vec2(2, 1))
				brick.color = LJS.randColor()
			}
		}

		LJS.setCameraPos(levelSize.scale(0.5))

		new Paddle()

		// Create walls
		new Wall(vec2(-0.5, levelSize.y / 2), vec2(1, 100)) // left
		new Wall(vec2(levelSize.x + 0.5, levelSize.y / 2), vec2(1, 100)) // right
		new Wall(vec2(levelSize.x / 2, levelSize.y + 0.5), vec2(100, 1)) // top
	}

	/**
	 * SECTION: Game Update
	 * called every frame at 60 frames per second
	 * handle input and update the game state
	 */
	function gameUpdate() {
		if (!ball || ball.pos.y < -1) {
			// Destroy old ball
			if (ball) ball.destroy()

			ball = new Ball(LJS.cameraPos)
		}
	}

	/**
	 * SECTION: Game Update Post
	 * called after physics and objects are updated
	 * setup camera and prepare for render
	 */
	function gameUpdatePost() {}

	/**
	 * SECTION: Game Render
	 * called before objects are rendered
	 * draw any background effects that appear behind objects
	 */
	function gameRender() {
		// Draw background
		LJS.drawRect(LJS.cameraPos, vec2(100), rgb(0.5, 0.5, 0.5))
		// Draw level boundary
		LJS.drawRect(LJS.cameraPos, levelSize, rgb(0.1, 0.1, 0.1))
	}

	/**
	 * SECTION: Game Render Post
	 * called after objects are rendered
	 * draw effects or hud that appear above all objects
	 */
	function gameRenderPost() {}

	LJS.engineInit(
		gameInit,
		gameUpdate,
		gameUpdatePost,
		gameRender,
		gameRenderPost,
		[],
		canvasContainer
	)
}
