// Yak-130 (GLB, Draco + WebP) → AircraftRig: aileron, stabilizer xoay toàn phần, rudder,
// flap + flap mép trước tự hạ theo AoA/tốc độ (như FBW thật) và phanh khí trên lưng.
import { R2D, clamp, clamp01 } from '../core'
import type { AircraftFrame, AircraftRig } from '../three/aircraft-rig'
import { disposeObject } from '../three/dispose'
import {
	DRACO_PATH,
	applySurfaces,
	createSurface,
	driveSurface,
	loadGltfModel,
	type GltfRigOptions,
} from './gltf-rig'

export const YAK130_URL = '/3d-models/Yak130_web.glb'

// MainWheel_*/NoseWheel là con của càng tương ứng
const GEAR_NODES = [
	'NoseGear',
	'MainGear_L',
	'MainGear_R',
	'NoseDoor_L',
	'NoseDoor_R',
	'MainDoor_L',
	'MainDoor_R',
]

/** flap sau hạ dần dưới FLAPS_UP, hạ hết ở FLAPS_FULL (m/s), khớp CONFIGS.aerobatic */
const FLAPS_UP = 95
const FLAPS_FULL = 60

export async function loadYak130Rig({
	url = YAK130_URL,
	dracoPath = DRACO_PATH,
}: GltfRigOptions = {}): Promise<AircraftRig> {
	const { root, node } = await loadGltfModel(url, 'Yak130', dracoPath)
	for (const name of GEAR_NODES) node(name).visible = false

	const surface = (name: string, axis: 'x' | 'y') => createSurface(node(name), axis)
	const s = {
		aileronL: surface('Aileron_L', 'x'),
		aileronR: surface('Aileron_R', 'x'),
		flapL: surface('Flap_L', 'x'),
		flapR: surface('Flap_R', 'x'),
		lefInL: surface('LEFlapIn_L', 'x'),
		lefInR: surface('LEFlapIn_R', 'x'),
		lefOutL: surface('LEFlapOut_L', 'x'),
		lefOutR: surface('LEFlapOut_R', 'x'),
		stabL: surface('Stab_L', 'x'),
		stabR: surface('Stab_R', 'x'),
		rudder: surface('Rudder', 'y'),
		// bản lề ở mép trước, tấm phanh nằm phía sau → góc dương = dựng lên
		airbrake: surface('Airbrake', 'x'),
	}
	const all = Object.values(s)

	let landingFlap = 0

	function animate({ state, cmd, dt }: AircraftFrame) {
		// FBW tiêm kích-huấn luyện: cơ cấu nhanh (~70 ms), flap hạ cánh mất ~2 s
		const k = 1 - Math.exp(-dt / 0.07)
		const kFlap = 1 - Math.exp(-dt / 2)
		const kBrake = 1 - Math.exp(-dt / 0.35)
		const roll = cmd.roll
		const aoaDeg = state.aoa * R2D
		landingFlap +=
			(clamp01((FLAPS_UP - state.speed) / (FLAPS_UP - FLAPS_FULL)) - landingFlap) * kFlap
		// flap cơ động: AoA cao thì cả mép trước lẫn mép sau cùng hạ để giữ dòng khí bám cánh
		const maneuverFlap = clamp01((aoaDeg - 6) / 14)
		const flap = Math.max(landingFlap * 0.45, maneuverFlap * 0.2)
		const lef = Math.max(landingFlap * 0.25, clamp01(aoaDeg / 20) * 0.4)

		driveSurface(s.aileronL, -roll * 0.35, k)
		driveSurface(s.aileronR, roll * 0.35, k)
		// flap sau lệch nhẹ theo lệnh liệng (flaperon) rồi cộng độ hạ
		driveSurface(s.flapL, -roll * 0.08 - flap, k)
		driveSurface(s.flapR, roll * 0.08 - flap, k)
		for (const sf of [s.lefInL, s.lefInR, s.lefOutL, s.lefOutR]) driveSurface(sf, lef, k)
		// stabilizer xoay toàn phần: lệnh pitch + trim theo AoA, lệch vi sai một chút khi liệng
		const trim = clamp(aoaDeg, -5, 20) * 0.004
		driveSurface(s.stabL, cmd.pitch * 0.3 + trim - roll * 0.06, k)
		driveSurface(s.stabR, cmd.pitch * 0.3 + trim + roll * 0.06, k)
		driveSurface(s.rudder, cmd.yaw * 0.35, k)
		driveSurface(s.airbrake, cmd.brake ? 0.8 : 0, kBrake)
		applySurfaces(all)
	}

	return {
		object: root,
		span: 4.65,
		camDist: 24,
		camH: 6,
		shadowSize: 9,
		animate,
		dispose: () => disposeObject(root),
	}
}
