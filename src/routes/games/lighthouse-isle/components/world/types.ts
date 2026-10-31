import type * as THREE from 'three'

import type { ToonKit } from './toon-material'

export type WorldContext = {
	scene: THREE.Scene
	rng: () => number
	toon: ToonKit['toon']
}
