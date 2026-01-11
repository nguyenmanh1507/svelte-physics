export type Swap = { fromX: number; fromY: number; toX: number; toY: number }

export interface Board {
	areAdjacent(ax: number, ay: number, bx: number, by: number): boolean
	swap(ax: number, ay: number, bx: number, by: number): void

	// optional convenience for revert logic
	lastSwap: Swap | null

	// match-3 operations
	clear(matches: Cell[]): void
}

export type Cell = { x: number; y: number }

export interface MatchFinder {
	findAllMatches(board: Board): Cell[] // simplest form: return all matched cells
}

export type PieceMove = { fromX: number; fromY: number; toX: number; toY: number }

export interface GravitySolver {
	computeFalls(board: Board): PieceMove[]
	apply(board: Board, moves: PieceMove[]): void
}

export type Spawn = { x: number; y: number; pieceId: number }

export interface Spawner {
	fillHoles(board: Board): Spawn[]
}

export interface Animator {
	playSwap(s: Swap, tag: string): void
	playClear(cells: Cell[], tag: string): void
	playFalls(moves: PieceMove[], tag: string): void
	playSpawns(spawns: Spawn[], tag: string): void
}

export interface InputAdapter {
	pollEvents(): import('./events').GameEvent[]
}

export type GameContext = {
	board: Board
	matchFinder: MatchFinder
	gravity: GravitySolver
	spawner: Spawner
	anim: Animator
	input: InputAdapter
}
