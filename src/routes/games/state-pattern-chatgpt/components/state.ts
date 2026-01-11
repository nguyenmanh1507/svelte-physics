import type { GameEvent } from './events'

export interface IState {
	enter(): void
	exit(): void
	tick(dt: number): void

	/**
	 * Return true if the state handled the event.
	 * If false, the event should bubble upward.
	 */
	handle(e: GameEvent): boolean
}
