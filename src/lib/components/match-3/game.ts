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

	const candy1 = game.sprite('candies', { frame: 0 })
	const candy2 = game.sprite('candies', { frame: 1 })
	const candy3 = game.sprite('candies', { frame: 2 })
	const candy4 = game.sprite('candies', { frame: 3 })
	const candy5 = game.sprite('candies', { frame: 4 })

	game.scene('game', () => {
		// Add background
		game.add([
			game.sprite('backgroundBlur'),
			game.pos(0, 0),
			game.scale(game.width() / 1024, game.height() / 768),
		])

		// Grid configuration
		const GRID_WIDTH = 8
		const GRID_HEIGHT = 8
		const GRID_PADDING = 20
		const CELL_SIZE = Math.min(
			(game.width() - GRID_PADDING * 2) / GRID_WIDTH,
			(game.height() - GRID_PADDING * 2) / GRID_HEIGHT
		)

		// Calculate grid starting position (centered)
		const gridStartX = (game.width() - CELL_SIZE * GRID_WIDTH) / 2
		const gridStartY = (game.height() - CELL_SIZE * GRID_HEIGHT) / 2

		// Helper function to convert grid coordinates to screen position
		function gridToPos(col: number, row: number) {
			return game.vec2(
				gridStartX + col * CELL_SIZE + CELL_SIZE / 2,
				gridStartY + row * CELL_SIZE + CELL_SIZE / 2
			)
		}

		function createCandy({ index, col, row }: { index: number; col: number; row: number }) {
			const candiesMap = [candy1, candy2, candy3, candy4, candy5]
			const candy = game.add([
				candiesMap[index],
				game.pos(gridToPos(col, row)),
				game.anchor('center'),
			])
			return candy
		}

		function createGrid() {
			for (let row = 0; row < GRID_HEIGHT; row++) {
				for (let col = 0; col < GRID_WIDTH; col++) {
					const randomIndex = Math.floor(Math.random() * 5)
					createCandy({ index: randomIndex, col, row })
				}
			}
		}

		function showDebugGrid() {
			for (let i = 0; i <= GRID_WIDTH; i++) {
				// Vertical lines
				game.add([
					game.rect(1, CELL_SIZE * GRID_WIDTH),
					game.pos(gridStartX + i * CELL_SIZE, gridStartY),
					game.color(255, 255, 255),
					game.opacity(0.5),
				])
				// Horizontal lines
				game.add([
					game.rect(CELL_SIZE * GRID_WIDTH, 1),
					game.pos(gridStartX, gridStartY + i * CELL_SIZE),
					game.color(255, 255, 255),
					game.opacity(0.5),
				])
			}
		}

		createGrid()
		showDebugGrid()
	})

	// Start the game scene
	game.go('game')
}
