// Boeing 777 (GLB, Draco + WebP) → AircraftRig: aileron/flaperon/elevator/rudder,
// cánh tà Fowler + slat tự hạ theo tốc độ, quạt động cơ quay theo ga.
import * as THREE from 'three'

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

export const B777_URL = '/3d-models/B777_web.glb'

// MainDoor_*/MainWheels_* là con của MainGear_*, NoseWheels là con của NoseGear
const GEAR_NODES = ['NoseGear', 'MainGear_L', 'MainGear_R', 'NoseDoor_L', 'NoseDoor_R']

/**
 * Lịch cánh tà theo tốc độ (m/s), khớp CONFIGS.transport: thu hết trên FLAPS_UP,
 * hạ hết dưới FLAPS_FULL. Slat ra trước, flap theo sau như cần gạt flap thật.
 */
const FLAPS_UP = 115
const FLAPS_FULL = 75

const AFT = new THREE.Vector3(0, 0, -1)
const FWD = new THREE.Vector3(0, 0, 1)

export async function loadB777Rig({
	url = B777_URL,
	dracoPath = DRACO_PATH,
}: GltfRigOptions = {}): Promise<AircraftRig> {
	const { root, node } = await loadGltfModel(url, 'B777', dracoPath)
	for (const name of GEAR_NODES) node(name).visible = false

	const surface = (name: string, axis: 'x' | 'y', slide?: THREE.Vector3) =>
		createSurface(node(name), axis, slide)
	const s = {
		aileronL: surface('Aileron_L', 'x'),
		aileronR: surface('Aileron_R', 'x'),
		flaperonL: surface('Flaperon_L', 'x'),
		flaperonR: surface('Flaperon_R', 'x'),
		flapInL: surface('FlapIn_L', 'x', AFT),
		flapInR: surface('FlapIn_R', 'x', AFT),
		flapOutL: surface('FlapOut_L', 'x', AFT),
		flapOutR: surface('FlapOut_R', 'x', AFT),
		slatL: surface('Slat_L', 'x', FWD),
		slatR: surface('Slat_R', 'x', FWD),
		elevatorL: surface('Elevator_L', 'x'),
		elevatorR: surface('Elevator_R', 'x'),
		// cả cụm đuôi ngang là stabilizer trim được; elevator là con của nó
		stab: surface('Stab', 'x'),
		rudder: surface('Rudder', 'y'),
	}
	const all = Object.values(s)
	const fans = [node('Fan_L'), node('Fan_R')]

	let highLift = 0
	let fanAngle = 0

	function animate({ state, cmd, dt }: AircraftFrame) {
		// cơ cấu thuỷ lực của máy bay lớn chậm hơn tiêm kích (~120 ms); flap/slat mất vài giây
		const k = 1 - Math.exp(-dt / 0.12)
		const kHigh = 1 - Math.exp(-dt / 2.5)
		highLift += (clamp01((FLAPS_UP - state.speed) / (FLAPS_UP - FLAPS_FULL)) - highLift) * kHigh
		const slat = clamp01(highLift * 2)
		const flap = clamp01(highLift * 1.25 - 0.25)
		const roll = cmd.roll
		// aileron ngoài bị khoá dần khi bay nhanh (như 777 thật), flaperon làm việc chính
		const outboard = 0.3 + 0.7 * highLift
		// tỉ số rudder giảm theo tốc độ để đuôi không bẻ gãy thân
		const rudderRatio = 0.45 + 0.55 * highLift

		driveSurface(s.aileronL, -roll * 0.35 * outboard - flap * 0.12, k)
		driveSurface(s.aileronR, roll * 0.35 * outboard - flap * 0.12, k)
		// flaperon rủ xuống cùng flap rồi mới cộng lệnh liệng
		driveSurface(s.flaperonL, -roll * 0.28 - flap * 0.35, k)
		driveSurface(s.flaperonR, roll * 0.28 - flap * 0.35, k)
		// Fowler: vừa lùi ra sau vừa gập xuống, flap trong dài hơn nên trượt xa hơn
		driveSurface(s.flapInL, -flap * 0.55, kHigh, flap * 1.2, kHigh)
		driveSurface(s.flapInR, -flap * 0.55, kHigh, flap * 1.2, kHigh)
		driveSurface(s.flapOutL, -flap * 0.5, kHigh, flap * 0.7, kHigh)
		driveSurface(s.flapOutR, -flap * 0.5, kHigh, flap * 0.7, kHigh)
		driveSurface(s.slatL, slat * 0.4, kHigh, slat * 0.35, kHigh)
		driveSurface(s.slatR, slat * 0.4, kHigh, slat * 0.35, kHigh)
		driveSurface(s.elevatorL, cmd.pitch * 0.35, k)
		driveSurface(s.elevatorR, cmd.pitch * 0.35, k)
		// trim tự động: AoA càng cao (bay chậm) mép trước stab càng chúc xuống
		driveSurface(s.stab, clamp(state.aoa * R2D, -4, 12) * 0.006, 1 - Math.exp(-dt / 1.5))
		driveSurface(s.rudder, cmd.yaw * 0.4 * rudderRatio, k)
		applySurfaces(all)

		// N1: quạt quay chậm ở idle, nhanh dần theo ga (ga đã có độ trễ spool trong flight model)
		fanAngle = (fanAngle + dt * (5 + state.throttle * 16)) % (Math.PI * 2)
		for (const f of fans) f.rotation.z = fanAngle
	}

	return {
		object: root,
		span: 32.4,
		camDist: 100,
		camH: 21,
		shadowSize: 55,
		animate,
		dispose: () => disposeObject(root),
	}
}
