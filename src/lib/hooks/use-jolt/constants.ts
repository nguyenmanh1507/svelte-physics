import type { MotionType, ObjectLayer } from './types'

export const LAYER_NON_MOVING = 0
export const LAYER_MOVING = 1
export const NUM_OBJECT_LAYERS = 2
export const NUM_BROAD_PHASE_LAYERS = 2

export const DEFAULT_MAX_DELTA = 1 / 30
export const DEFAULT_SUB_STEP_THRESHOLD = 1 / 55
export const DEFAULT_SLOW_FRAME_SUB_STEPS = 2
export const DEFAULT_NORMAL_SUB_STEPS = 1

export const DEFAULT_MOTION_TYPE: MotionType = 'dynamic'

export const OBJECT_LAYER_BY_NAME: Record<ObjectLayer, number> = {
	nonMoving: LAYER_NON_MOVING,
	moving: LAYER_MOVING,
}
