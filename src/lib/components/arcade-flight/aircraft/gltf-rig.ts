// Phần dùng chung cho các rig nạp từ GLB: loader Draco/WebP và bề mặt điều khiển có bản lề.
import * as THREE from 'three'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

// decoder WASM chép từ three/examples/jsm/libs vào static/libs (cùng phiên bản three)
export const DRACO_PATH = '/libs/draco/'

export type GltfRigOptions = { url?: string; dracoPath?: string }

/**
 * Nạp GLB (mũi +Z, cánh trái +X như Blender export) và xoay 180° quanh Y cho đúng
 * quy ước rig mũi −Z. Trả về group gốc và hàm tìm node theo tên (ném lỗi nếu thiếu).
 */
export async function loadGltfModel(url: string, label: string, dracoPath = DRACO_PATH) {
	const draco = new DRACOLoader().setDecoderPath(dracoPath)
	const loader = new GLTFLoader().setDRACOLoader(draco)
	let gltf
	try {
		gltf = await loader.loadAsync(url)
	} finally {
		draco.dispose()
	}
	const model = gltf.scene
	model.rotation.y = Math.PI
	const root = new THREE.Group()
	root.name = `${label}Rig`
	root.add(model)
	const node = (name: string) => {
		const n = model.getObjectByName(name)
		if (!n) throw new Error(`${label}: thiếu node ${name}`)
		return n
	}
	return { root, model, node }
}

/**
 * Bề mặt quay quanh một trục cục bộ của node, chồng lên hướng gốc trong GLB.
 * Quy ước góc dương: quanh X = mép sau đi lên (mép trước đi xuống),
 * quanh Y = mép sau lệch sang phải máy bay. `sign` bù cho node bên phải được
 * export dạng đối xứng (trục cục bộ lật ngược), nên code hoạt ảnh không cần biết.
 */
export type Surface = {
	node: THREE.Object3D
	base: THREE.Quaternion
	basePos: THREE.Vector3
	axis: THREE.Vector3
	sign: number
	angle: number
	/** hướng trượt trong không gian cha (flap Fowler, slat) và quãng trượt hiện tại (m) */
	slideDir: THREE.Vector3
	slide: number
}

const AXES = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0) }

/**
 * `slideLocal`: hướng trượt theo trục cục bộ của node (vd. (0,0,−1) = lùi về mép sau),
 * không có thì bề mặt chỉ quay.
 */
export function createSurface(
	node: THREE.Object3D,
	axis: 'x' | 'y',
	slideLocal?: THREE.Vector3
): Surface {
	const base = node.quaternion.clone()
	// trong hệ GLB: lưng +Y, phải máy bay −X
	const sign =
		axis === 'x'
			? Math.sign(new THREE.Vector3(0, 1, 0).applyQuaternion(base).y) || 1
			: Math.sign(new THREE.Vector3(1, 0, 0).applyQuaternion(base).x) || 1
	return {
		node,
		base,
		basePos: node.position.clone(),
		axis: AXES[axis],
		sign,
		angle: 0,
		slideDir: slideLocal ? slideLocal.clone().applyQuaternion(base) : new THREE.Vector3(),
		slide: 0,
	}
}

/** Lọc bậc nhất về góc đích (rad) và quãng trượt đích (m); `k` = 1 − e^(−dt/τ) */
export function driveSurface(sf: Surface, angle: number, k: number, slide = 0, kSlide = k) {
	sf.angle += (angle - sf.angle) * k
	sf.slide += (slide - sf.slide) * kSlide
}

const tmpQ = new THREE.Quaternion()

export function applySurfaces(surfaces: Surface[]) {
	for (const sf of surfaces) {
		sf.node.quaternion.copy(sf.base).multiply(tmpQ.setFromAxisAngle(sf.axis, sf.angle * sf.sign))
		sf.node.position.copy(sf.basePos).addScaledVector(sf.slideDir, sf.slide)
	}
}
