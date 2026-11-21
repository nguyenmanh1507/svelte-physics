// Su-57 (GLB, Draco + WebP) → AircraftRig với bề mặt điều khiển, vòi TVC và lửa đuôi chuyển động.
import { R2D, clamp, clamp01 } from '../core'
import type { AircraftFrame, AircraftRig } from '../three/aircraft-rig'
import { disposeObject } from '../three/dispose'
import { createFlame, updateFlame } from './afterburner'
import {
	DRACO_PATH,
	applySurfaces,
	createSurface,
	driveSurface,
	loadGltfModel,
	type GltfRigOptions,
} from './gltf-rig'

export const SU57_URL = '/3d-models/su-57/Su57E_web.glb'

// càng đáp và cửa khoang: máy bay luôn ở trên không nên ẩn đi
const GEAR_NODES = [
	'NoseGear',
	'MainGear_L',
	'MainGear_R',
	'NoseDoor_L',
	'NoseDoor_R',
	'MainDoor_L',
	'MainDoor_R',
]

export async function loadSu57Rig({
	url = SU57_URL,
	dracoPath = DRACO_PATH,
}: GltfRigOptions = {}): Promise<AircraftRig> {
	const { root, node } = await loadGltfModel(url, 'Su57', dracoPath)
	for (const name of GEAR_NODES) node(name).visible = false

	const surface = (name: string, axis: 'x' | 'y') => createSurface(node(name), axis)
	const s = {
		aileronL: surface('Aileron_L', 'x'),
		aileronR: surface('Aileron_R', 'x'),
		flaperonL: surface('Flaperon_L', 'x'),
		flaperonR: surface('Flaperon_R', 'x'),
		stabL: surface('Stab_L', 'x'),
		stabR: surface('Stab_R', 'x'),
		finL: surface('Fin_L', 'y'),
		finR: surface('Fin_R', 'y'),
		levconL: surface('LEVCON_L', 'x'),
		levconR: surface('LEVCON_R', 'x'),
		lefL: surface('LEFlap_L', 'x'),
		lefR: surface('LEFlap_R', 'x'),
		nozzleL: surface('Nozzle_L', 'x'),
		nozzleR: surface('Nozzle_R', 'x'),
	}
	const all = Object.values(s)

	// lửa gắn vào vòi phụt để lệch theo TVC; miệng vòi ở z ≈ −1,64 cục bộ
	const flames = [s.nozzleL.node, s.nozzleR.node].map((n) => {
		const f = createFlame(0.46, 5, -1)
		f.position.z = -1.6
		n.add(f)
		return f
	})

	function animate({ state, cmd, dt }: AircraftFrame) {
		// cơ cấu chấp hành có quán tính: bám lệnh theo hằng số thời gian ~80 ms
		const k = 1 - Math.exp(-dt / 0.08)
		const set = (sf: (typeof all)[number], target: number) => driveSurface(sf, target, k)
		const roll = cmd.roll
		const pitch = cmd.pitch
		const yaw = cmd.yaw
		const brake = cmd.brake ? 1 : 0
		const aoaDeg = state.aoa * R2D
		// TVC theo tốc độ quay thực (cobra/kulbit dùng rate override chứ không qua stick)
		const tvcPitch = clamp(-state.angVel.x / 1.5, -1, 1)

		set(s.aileronL, -roll * 0.35 + brake * 0.35)
		set(s.aileronR, roll * 0.35 + brake * 0.35)
		set(s.flaperonL, -roll * 0.2 - brake * 0.35)
		set(s.flaperonR, roll * 0.2 - brake * 0.35)
		set(s.stabL, pitch * 0.3 - roll * 0.12)
		set(s.stabR, pitch * 0.3 + roll * 0.12)
		// phanh khí kiểu Su-57: hai bánh lái đứng xoè ra ngoài
		set(s.finL, yaw * 0.3 - brake * 0.5)
		set(s.finR, yaw * 0.3 + brake * 0.5)
		const levcon = clamp01(aoaDeg / 25) * 0.3
		set(s.levconL, levcon)
		set(s.levconR, levcon)
		const lef = clamp01(aoaDeg / 20) * 0.35
		set(s.lefL, lef)
		set(s.lefR, lef)
		set(s.nozzleL, tvcPitch * 0.26 - roll * 0.1)
		set(s.nozzleR, tvcPitch * 0.26 + roll * 0.1)

		applySurfaces(all)
		for (const f of flames) updateFlame(f, state.throttle, state.ab)
	}

	return {
		object: root,
		span: 6.9,
		camDist: 38,
		camH: 9.5,
		shadowSize: 15,
		animate,
		dispose: () => disposeObject(root),
	}
}
