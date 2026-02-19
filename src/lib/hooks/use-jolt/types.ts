export type MotionType = 'static' | 'dynamic' | 'kinematic'

export type ObjectLayer = 'nonMoving' | 'moving'

export type Vec3Tuple = [number, number, number]

export type QuatTuple = [number, number, number, number]

export type SphereShapeOptions = {
	type: 'sphere'
	radius: number
}

export type BoxShapeOptions = {
	type: 'box'
	halfExtent: Vec3Tuple
	convexRadius?: number
}

export type JoltShapeOptions = SphereShapeOptions | BoxShapeOptions

export type RigidBodyOptions = {
	shape: JoltShapeOptions
	motionType?: MotionType
	layer?: ObjectLayer
	position?: Vec3Tuple
	rotation?: QuatTuple
	restitution?: number
	friction?: number
	linearVelocity?: Vec3Tuple
	angularVelocity?: Vec3Tuple
}

export type JoltWorldStepConfig = {
	maxDelta?: number
	subStepThreshold?: number
	slowFrameSubSteps?: number
	normalSubSteps?: number
	autoStep?: boolean
}
