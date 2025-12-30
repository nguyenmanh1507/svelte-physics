/**
 * ================================
 * State Pattern: Match-3 Game Piece Example
 * ================================
 *
 * This demonstrates the State pattern using a game piece in a match-3 puzzle game.
 *
 * A game piece can be in different states:
 * - Idle: Normal state, can be clicked/selected
 * - Selected: Player has selected this piece
 * - Swapping: Piece is currently being swapped with another piece
 * - Matched: Piece is part of a match and will be removed
 * - Falling: Piece is falling down to fill empty spaces
 *
 * Each state defines different behavior for the same actions (click, swap, match, etc.)
 * The piece transitions between states based on game events.
 */

/**
 * GamePiece is the Context - it represents a single piece on the game board.
 * It maintains a reference to its current state and delegates behavior to that state.
 */
export class GamePiece {
	private state!: PieceState
	private color: string
	private x: number
	private y: number

	constructor(color: string, x: number, y: number, initialState: PieceState) {
		this.color = color
		this.x = x
		this.y = y
		this.transitionTo(initialState)
	}

	/**
	 * Changes the piece's state. This is called internally by states when they want
	 * to transition to a different state.
	 */
	public transitionTo(state: PieceState): void {
		console.log(
			`[${this.color} piece at (${this.x},${this.y})] Transitioning to: ${state.constructor.name}`
		)
		this.state = state
		this.state.setPiece(this)
	}

	/**
	 * Player clicks on this piece. Behavior depends on current state.
	 */
	public onClick(): void {
		this.state.onClick()
	}

	/**
	 * Another piece wants to swap with this one. Behavior depends on current state.
	 */
	public onSwapRequest(): void {
		this.state.onSwapRequest()
	}

	/**
	 * This piece is part of a match. Behavior depends on current state.
	 */
	public onMatch(): void {
		this.state.onMatch()
	}

	/**
	 * Animation/falling logic completes. Behavior depends on current state.
	 */
	public onAnimationComplete(): void {
		this.state.onAnimationComplete()
	}

	public getColor(): string {
		return this.color
	}

	public getPosition(): { x: number; y: number } {
		return { x: this.x, y: this.y }
	}
}

/**
 * Base State class - defines the interface that all piece states must implement.
 * Each concrete state will implement these methods differently.
 */
abstract class PieceState {
	protected piece!: GamePiece

	public setPiece(piece: GamePiece): void {
		this.piece = piece
	}

	/**
	 * What happens when player clicks on the piece in this state?
	 */
	public abstract onClick(): void

	/**
	 * What happens when another piece wants to swap with this one?
	 */
	public abstract onSwapRequest(): void

	/**
	 * What happens when this piece is detected as part of a match?
	 */
	public abstract onMatch(): void

	/**
	 * What happens when an animation completes?
	 */
	public abstract onAnimationComplete(): void
}

/**
 * Idle State: The piece is waiting for player interaction.
 * - Can be clicked to select it
 * - Can receive swap requests
 * - Can be matched
 */
class IdleState extends PieceState {
	public onClick(): void {
		console.log(`  → IdleState: Piece clicked! Selecting it...`)
		// Transition to Selected state when clicked
		this.piece.transitionTo(new SelectedState())
	}

	public onSwapRequest(): void {
		console.log(`  → IdleState: Swap request received. Starting swap animation...`)
		// Transition to Swapping state
		this.piece.transitionTo(new SwappingState())
	}

	public onMatch(): void {
		console.log(`  → IdleState: Match detected! Preparing to remove piece...`)
		// Transition to Matched state
		this.piece.transitionTo(new MatchedState())
	}

	public onAnimationComplete(): void {
		console.log(`  → IdleState: Animation complete (no-op, already idle)`)
		// Nothing to do - already idle
	}
}

/**
 * Selected State: The piece is currently selected by the player.
 * - Clicking again deselects it (back to Idle)
 * - Can receive swap requests from adjacent pieces
 * - Can still be matched
 */
class SelectedState extends PieceState {
	public onClick(): void {
		console.log(`  → SelectedState: Piece clicked again! Deselecting...`)
		// Deselect - go back to Idle
		this.piece.transitionTo(new IdleState())
	}

	public onSwapRequest(): void {
		console.log(`  → SelectedState: Swap request received. Selected piece can swap!`)
		// Transition to Swapping state
		this.piece.transitionTo(new SwappingState())
	}

	public onMatch(): void {
		console.log(`  → SelectedState: Match detected! Deselecting and matching...`)
		// Deselect first, then match
		this.piece.transitionTo(new MatchedState())
	}

	public onAnimationComplete(): void {
		console.log(`  → SelectedState: Animation complete (no-op)`)
		// Nothing to do
	}
}

/**
 * Swapping State: The piece is currently being swapped with another piece.
 * - Cannot be clicked (swap in progress)
 * - Cannot receive another swap request
 * - After swap animation completes, check for matches
 */
class SwappingState extends PieceState {
	public onClick(): void {
		console.log(`  → SwappingState: Cannot click - swap in progress!`)
		// Ignore clicks during swap
	}

	public onSwapRequest(): void {
		console.log(`  → SwappingState: Already swapping - ignoring duplicate request`)
		// Ignore - already swapping
	}

	public onMatch(): void {
		console.log(`  → SwappingState: Match detected during swap!`)
		// Transition to Matched state
		this.piece.transitionTo(new MatchedState())
	}

	public onAnimationComplete(): void {
		console.log(`  → SwappingState: Swap animation complete! Checking for matches...`)
		// After swap completes, check if this piece is now part of a match
		// For demo purposes, we'll transition to Idle (in real game, would check for matches)
		this.piece.transitionTo(new IdleState())
	}
}

/**
 * Matched State: The piece is part of a match and will be removed.
 * - Cannot be clicked
 * - Cannot swap
 * - Plays removal animation, then transitions to Falling (or removed)
 */
class MatchedState extends PieceState {
	public onClick(): void {
		console.log(`  → MatchedState: Cannot click - piece is matched and will be removed!`)
		// Ignore - piece is being removed
	}

	public onSwapRequest(): void {
		console.log(`  → MatchedState: Cannot swap - piece is matched and will be removed!`)
		// Ignore - piece is being removed
	}

	public onMatch(): void {
		console.log(`  → MatchedState: Already matched - ignoring duplicate match`)
		// Already matched, ignore
	}

	public onAnimationComplete(): void {
		console.log(`  → MatchedState: Removal animation complete! Piece removed.`)
		// In a real game, the piece would be removed from the board here
		// For demo, we'll simulate it falling down to fill the space
		// In practice, you might have a separate "Removed" state or handle it differently
		console.log(`  → (In real game: piece would be removed, space filled by falling pieces)`)
	}
}

/**
 * Falling State: The piece is falling down to fill an empty space.
 * - Cannot be clicked while falling
 * - Cannot swap while falling
 * - After falling completes, check for matches
 */
class FallingState extends PieceState {
	public onClick(): void {
		console.log(`  → FallingState: Cannot click - piece is falling!`)
		// Ignore clicks while falling
	}

	public onSwapRequest(): void {
		console.log(`  → FallingState: Cannot swap - piece is falling!`)
		// Ignore swap requests while falling
	}

	public onMatch(): void {
		console.log(`  → FallingState: Match detected while falling!`)
		// Transition to Matched state
		this.piece.transitionTo(new MatchedState())
	}

	public onAnimationComplete(): void {
		console.log(`  → FallingState: Falling animation complete! Piece landed.`)
		// After landing, check for matches, then go to Idle
		this.piece.transitionTo(new IdleState())
	}
}

/**
 * ================================
 * Example Usage / Client Code
 * ================================
 */
export function demonstrateStatePattern(): void {
	console.log('\n=== Match-3 Game Piece State Pattern Demo ===\n')

	// Create a red piece at position (2, 3) starting in Idle state
	const redPiece = new GamePiece('red', 2, 3, new IdleState())

	console.log('\n--- Scenario 1: Player clicks on idle piece ---')
	redPiece.onClick() // Idle -> Selected

	console.log('\n--- Scenario 2: Player clicks selected piece again ---')
	redPiece.onClick() // Selected -> Idle

	console.log('\n--- Scenario 3: Player selects piece, then swap requested ---')
	redPiece.onClick() // Idle -> Selected
	redPiece.onSwapRequest() // Selected -> Swapping
	redPiece.onAnimationComplete() // Swapping -> Idle

	console.log('\n--- Scenario 4: Match detected on idle piece ---')
	redPiece.onMatch() // Idle -> Matched
	redPiece.onAnimationComplete() // Matched -> (removed in real game)

	console.log('\n--- Scenario 5: Piece falling down ---')
	const bluePiece = new GamePiece('blue', 1, 0, new FallingState())
	bluePiece.onAnimationComplete() // Falling -> Idle

	console.log('\n--- Scenario 6: Try to interact with falling piece ---')
	const greenPiece = new GamePiece('green', 4, 5, new FallingState())
	greenPiece.onClick() // Ignored - falling
	greenPiece.onSwapRequest() // Ignored - falling
	greenPiece.onMatch() // Falling -> Matched

	console.log('\n=== Demo Complete ===\n')
}

// Uncomment to run the demo:
// demonstrateStatePattern()
