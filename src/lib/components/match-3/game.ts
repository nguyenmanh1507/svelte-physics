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

		// Helper function to convert screen position to grid coordinates
		function posToGrid(pos: { x: number; y: number }) {
			const col = Math.floor((pos.x - gridStartX) / CELL_SIZE)
			const row = Math.floor((pos.y - gridStartY) / CELL_SIZE)
			return { col, row }
		}

		// Grid to store candy references
		const candyGrid: (ReturnType<typeof createCandy> | null)[][] = []
		for (let row = 0; row < GRID_HEIGHT; row++) {
			candyGrid[row] = []
			for (let col = 0; col < GRID_WIDTH; col++) {
				candyGrid[row][col] = null
			}
		}

		// Track dragging state
		let draggedCandy: ReturnType<typeof createCandy> | null = null
		let draggedFromPos = { col: -1, row: -1 }

		// Handle mouse/touch movement during drag
		game.onUpdate(() => {
			if (draggedCandy) {
				const mousePos = game.mousePos()
				draggedCandy.pos = mousePos
			}
		})

		// Handle mouse/touch release
		game.onMouseRelease(() => {
			if (!draggedCandy) return

			const currentPos = draggedCandy.pos
			const targetGrid = posToGrid(currentPos)

			// Check if dropped on a valid adjacent cell
			const colDiff = Math.abs(targetGrid.col - draggedFromPos.col)
			const rowDiff = Math.abs(targetGrid.row - draggedFromPos.row)
			const isAdjacent = (colDiff === 1 && rowDiff === 0) || (colDiff === 0 && rowDiff === 1)
			const isValid = targetGrid.col >= 0 && targetGrid.col < GRID_WIDTH &&
				targetGrid.row >= 0 && targetGrid.row < GRID_HEIGHT &&
				isAdjacent

			if (isValid && candyGrid[targetGrid.row] && candyGrid[targetGrid.row][targetGrid.col] !== draggedCandy) {
				// Swap candies
				const targetCandy = candyGrid[targetGrid.row][targetGrid.col]
				if (targetCandy) {
					swapCandies(draggedCandy, targetCandy)
				} else {
					// Empty cell, just move
					moveCandyToGrid(draggedCandy, targetGrid.col, targetGrid.row)
				}
			} else {
				// Return to original position
				returnToGrid(draggedCandy, draggedFromPos.col, draggedFromPos.row)
			}

			// Reset drag state
			if (draggedCandy) {
				draggedCandy.scale = game.vec2(1)
				draggedCandy.z = 0
			}
			draggedCandy = null
		})

		function createCandy({ index, col, row }: { index: number; col: number; row: number }) {
			const candiesMap = [candy1, candy2, candy3, candy4, candy5]
			const candy = game.add([
				candiesMap[index],
				game.pos(gridToPos(col, row)),
				game.anchor('center'),
				game.scale(1),
				game.z(0), // Add z component for layering
				game.area(),
				// Store grid position as custom data
				{ gridCol: col, gridRow: row, candyIndex: index },
			])

			// Store reference in grid
			candyGrid[row][col] = candy

			// Handle drag start (on click/touch)
			candy.onClick(() => {
				draggedCandy = candy
				draggedFromPos = { col: candy.gridCol, row: candy.gridRow }
				candy.scale = game.vec2(1.2) // Scale up when dragging
				candy.z = 100 // Bring to front
			})

			return candy
		}

		function moveCandyToGrid(candy: ReturnType<typeof createCandy>, col: number, row: number) {
			// Update grid references
			candyGrid[candy.gridRow][candy.gridCol] = null
			candyGrid[row][col] = candy

			// Update candy grid position
			candy.gridCol = col
			candy.gridRow = row

			// Animate to new position
			const targetPos = gridToPos(col, row)
			game.tween(
				candy.pos,
				targetPos,
				0.2,
				(p) => candy.pos = p,
				game.easings.easeOutQuad
			)
		}

		function returnToGrid(candy: ReturnType<typeof createCandy>, col: number, row: number) {
			const targetPos = gridToPos(col, row)
			game.tween(
				candy.pos,
				targetPos,
				0.2,
				(p) => candy.pos = p,
				game.easings.easeOutQuad
			)
			candy.gridCol = col
			candy.gridRow = row
		}

		function swapCandies(candy1: ReturnType<typeof createCandy>, candy2: ReturnType<typeof createCandy>) {
			const pos1 = { col: candy1.gridCol, row: candy1.gridRow }
			const pos2 = { col: candy2.gridCol, row: candy2.gridRow }

			// Update grid references
			candyGrid[pos1.row][pos1.col] = candy2
			candyGrid[pos2.row][pos2.col] = candy1

			// Update candy grid positions
			candy1.gridCol = pos2.col
			candy1.gridRow = pos2.row
			candy2.gridCol = pos1.col
			candy2.gridRow = pos1.row

			// Animate swap
			const targetPos1 = gridToPos(pos2.col, pos2.row)
			const targetPos2 = gridToPos(pos1.col, pos1.row)

			game.tween(
				candy1.pos,
				targetPos1,
				0.2,
				(p) => candy1.pos = p,
				game.easings.easeOutQuad
			)

			game.tween(
				candy2.pos,
				targetPos2,
				0.2,
				(p) => candy2.pos = p,
				game.easings.easeOutQuad
			)

			console.log(`Swapped candies: (${pos1.col}, ${pos1.row}) <-> (${pos2.col}, ${pos2.row})`)
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
