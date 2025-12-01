import kaplay from 'kaplay'
import backgroundUrl from './assets/background.png?url'
import backgroundBlurUrl from './assets/background_blur.png?url'
import candiesUrl from './assets/assets_candy.png?url'
import explosionUrl from './assets/explosion.png?url'

export function initGame(canvas: HTMLCanvasElement) {
	const game = kaplay({
		canvas,
	})

	game.loadSprite('background', backgroundUrl)
	game.loadSprite('backgroundBlur', backgroundBlurUrl)
	game.loadSprite('candies', candiesUrl, {
		sliceX: 7,
		sliceY: 7,
	})
	game.loadSprite('explosion', explosionUrl, {
		sliceX: 4,
		sliceY: 2,
		anims: {
			explode: {
				from: 0,
				to: 7,
				speed: 24, // 24 frames per second
			},
		},
	})

	game.scene('game', () => {
		game.add([
			game.sprite('background'),
			game.pos(0, 0),
			game.scale(game.width() / 1024, game.height() / 768), // Adjust 1024x768 to match your actual background image size
		])
	})

	// Start the game scene
	game.go('game')
}
