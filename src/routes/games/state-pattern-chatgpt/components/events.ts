export type GameEvent =
	| { type: 'TapCell'; x: number; y: number }
	| { type: 'DragSwap'; fromX: number; fromY: number; toX: number; toY: number }
	| { type: 'AnimationFinished'; tag: string }
	| { type: 'PausePressed' }
	| { type: 'ResumePressed' }
	| { type: 'StartPressed' }
