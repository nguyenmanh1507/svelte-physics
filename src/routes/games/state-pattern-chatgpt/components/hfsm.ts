import type { IState } from './state'
import type { GameEvent } from './events'

export abstract class StateBase implements IState {
	protected child: StateBase | null = null
	public parent: StateBase | null = null

	constructor(protected readonly sm: StateMachine) {}

	setParent(parent: StateBase | null) {
		this.parent = parent
	}

	enter(): void {}
	exit(): void {
		// Exit child first (leaf -> parent)
		if (this.child) {
			this.child.exit()
			this.child = null
		}
	}

	tick(dt: number): void {
		this.child?.tick(dt)
	}

	handle(e: GameEvent): boolean {
		// 1) Leaf tries first
		if (this.child && this.child.handle(e)) return true

		// 2) This state
		if (this.onHandle(e)) return true

		// 3) Bubble to parent
		return this.parent ? this.parent.handle(e) : false
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	protected onHandle(_e: GameEvent): boolean {
		return false
	}

	protected setChild(next: StateBase | null) {
		if (this.child) this.child.exit()
		this.child = next
		if (this.child) {
			this.child.setParent(this)
			this.child.enter()
		}
	}
}

export class StateMachine {
	private root: StateBase | null = null

	setRoot(root: StateBase) {
		this.root?.exit()
		this.root = root
		this.root.setParent(null)
		this.root.enter()
	}

	tick(dt: number) {
		this.root?.tick(dt)
	}

	send(e: GameEvent) {
		this.root?.handle(e)
	}

	// Optional: debug helpers
	getRoot(): StateBase | null {
		return this.root
	}
}
