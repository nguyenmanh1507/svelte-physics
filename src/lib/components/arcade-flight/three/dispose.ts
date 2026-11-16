import * as THREE from 'three'

/** Giải phóng geometry, material và texture của cả cây object */
export function disposeObject(root: THREE.Object3D) {
	root.removeFromParent()
	root.traverse((o) => {
		if (!(o instanceof THREE.Mesh)) return
		o.geometry.dispose()
		const mats: THREE.Material[] = Array.isArray(o.material) ? o.material : [o.material]
		for (const m of mats) {
			for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose()
			m.dispose()
		}
	})
}
