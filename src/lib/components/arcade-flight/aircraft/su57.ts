// Su-57 (GLB, Draco + WebP) → AircraftRig với bề mặt điều khiển, vòi TVC và lửa đuôi chuyển động.
import * as THREE from 'three'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

import { R2D, clamp, clamp01 } from '../core'
import type { AircraftFrame, AircraftRig } from '../three/aircraft-rig'
import { disposeObject } from '../three/dispose'
import { createFlame, updateFlame } from './afterburner'

export const SU57_URL = '/3d-models/su-57/Su57E_web.glb'
// decoder WASM chép từ three/examples/jsm/libs vào static/libs (cùng phiên bản three)
const DRACO_PATH = '/libs/draco/'

/** Bề mặt quay quanh một trục cục bộ của node, chồng lên hướng gốc trong GLB */
type Surface = { node: THREE.Object3D; base: THREE.Quaternion; axis: THREE.Vector3; angle: number }

const AXIS_X = new THREE.Vector3(1, 0, 0)
const AXIS_Y = new THREE.Vector3(0, 1, 0)
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

export type Su57Options = { url?: string; dracoPath?: string }

export async function loadSu57Rig({
	url = SU57_URL,
	dracoPath = DRACO_PATH,
}: Su57Options = {}): Promise<AircraftRig> {
	const draco = new DRACOLoader().setDecoderPath(dracoPath)
	const loader = new GLTFLoader().setDRACOLoader(draco)
	let gltf
	try {
		gltf = await loader.loadAsync(url)
	} finally {
		draco.dispose()
	}

	// GLB dựng mũi hướng +Z, cánh trái +X → xoay 180° quanh Y cho đúng quy ước mũi −Z
	const model = gltf.scene
	model.rotation.y = Math.PI
	const root = new THREE.Group()
	root.name = 'Su57Rig'
	root.add(model)

	const node = (name: string) => {
		const n = model.getObjectByName(name)
		if (!n) throw new Error(`Su-57: thiếu node ${name}`)
		return n
	}
	for (const name of GEAR_NODES) node(name).visible = false

	const surface = (name: string, axis: THREE.Vector3): Surface => {
		const n = node(name)
		return { node: n, base: n.quaternion.clone(), axis, angle: 0 }
	}
	// góc dương quanh X cục bộ = mép sau đi lên (mép trước đi xuống); quanh Y = mép sau sang phải máy bay
	const s = {
		aileronL: surface('Aileron_L', AXIS_X),
		aileronR: surface('Aileron_R', AXIS_X),
		flaperonL: surface('Flaperon_L', AXIS_X),
		flaperonR: surface('Flaperon_R', AXIS_X),
		stabL: surface('Stab_L', AXIS_X),
		stabR: surface('Stab_R', AXIS_X),
		finL: surface('Fin_L', AXIS_Y),
		finR: surface('Fin_R', AXIS_Y),
		levconL: surface('LEVCON_L', AXIS_X),
		levconR: surface('LEVCON_R', AXIS_X),
		lefL: surface('LEFlap_L', AXIS_X),
		lefR: surface('LEFlap_R', AXIS_X),
		nozzleL: surface('Nozzle_L', AXIS_X),
		nozzleR: surface('Nozzle_R', AXIS_X),
	}
	const all = Object.values(s)

	// lửa gắn vào vòi phụt để lệch theo TVC; miệng vòi ở z ≈ −1,64 cục bộ
	const flames = [s.nozzleL.node, s.nozzleR.node].map((n) => {
		const f = createFlame(0.46, 5, -1)
		f.position.z = -1.6
		n.add(f)
		return f
	})

	const q = new THREE.Quaternion()
	const set = (sf: Surface, target: number, k: number) => {
		sf.angle += (target - sf.angle) * k
	}

	function animate({ state, cmd, dt }: AircraftFrame) {
		// cơ cấu chấp hành có quán tính: bám lệnh theo hằng số thời gian ~80 ms
		const k = 1 - Math.exp(-dt / 0.08)
		const roll = cmd.roll
		const pitch = cmd.pitch
		const yaw = cmd.yaw
		const brake = cmd.brake ? 1 : 0
		const aoaDeg = state.aoa * R2D
		// TVC theo tốc độ quay thực (cobra/kulbit dùng rate override chứ không qua stick)
		const tvcPitch = clamp(-state.angVel.x / 1.5, -1, 1)

		set(s.aileronL, -roll * 0.35 + brake * 0.35, k)
		set(s.aileronR, roll * 0.35 + brake * 0.35, k)
		set(s.flaperonL, -roll * 0.2 - brake * 0.35, k)
		set(s.flaperonR, roll * 0.2 - brake * 0.35, k)
		set(s.stabL, pitch * 0.3 - roll * 0.12, k)
		set(s.stabR, pitch * 0.3 + roll * 0.12, k)
		// phanh khí kiểu Su-57: hai bánh lái đứng xoè ra ngoài
		set(s.finL, yaw * 0.3 - brake * 0.5, k)
		set(s.finR, yaw * 0.3 + brake * 0.5, k)
		const levcon = clamp01(aoaDeg / 25) * 0.3
		set(s.levconL, levcon, k)
		set(s.levconR, levcon, k)
		const lef = clamp01(aoaDeg / 20) * 0.35
		set(s.lefL, lef, k)
		set(s.lefR, lef, k)
		set(s.nozzleL, tvcPitch * 0.26 - roll * 0.1, k)
		set(s.nozzleR, tvcPitch * 0.26 + roll * 0.1, k)

		for (const sf of all)
			sf.node.quaternion.copy(sf.base).multiply(q.setFromAxisAngle(sf.axis, sf.angle))
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
