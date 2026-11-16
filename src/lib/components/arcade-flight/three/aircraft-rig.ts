import type * as THREE from 'three'

import type { ControlCmd, FlightState } from '../core'

/** Dữ liệu mỗi frame để rig tự hoạt ảnh (lửa đuôi, cánh quạt, bề mặt điều khiển…) */
export type AircraftFrame = {
	state: FlightState
	/** lệnh cuối cùng đưa vào flight model (đã qua pilot + maneuver) */
	cmd: ControlCmd
	/** thời gian frame, giây */
	dt: number
}

/**
 * Hợp đồng giữa controller và model máy bay. Model nào cũng dùng được miễn
 * `object` dựng theo quy ước Three.js: mũi hướng −Z, cánh phải +X, lưng +Y, gốc ở trọng tâm.
 */
export type AircraftRig = {
	object: THREE.Object3D
	/** nửa sải cánh (m) — vị trí sinh vệt hơi nước */
	span: number
	/** khoảng cách / độ cao camera bám đuôi (m) */
	camDist: number
	camH: number
	/** bán kính bóng đổ giả trên mặt đất (m) */
	shadowSize: number
	animate?(frame: AircraftFrame): void
	dispose?(): void
}
