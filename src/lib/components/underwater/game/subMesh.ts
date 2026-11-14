// Placeholder toy submarine built from primitives: 1 m long along +Z, centred on the origin.
import * as THREE from 'three/webgpu'
import { underwaterize } from '../water/underwaterize.js'
import { addOutline } from '../toon/outline'
import { makeToonMaterial } from '../toon/toonLit'
import type { Style } from '../toon/style'
import type { Material, Mesh, OceanNodes } from '../toon/types'

const RADIUS = 0.14
const LENGTH = 1

export function buildSubMesh(O: OceanNodes) {
	// every paint exists in both styles; setStyle swaps them on the meshes
	const paint = (color: number, roughness: number): Record<Style, Material> => ({
		realistic: underwaterize(
			new THREE.MeshStandardNodeMaterial({ color, roughness, metalness: 0 }),
			O
		),
		toon: makeToonMaterial(O, color, { rim: 0.9, shadows: false }),
	})
	const yellow = paint(0xf2c230, 0.45)
	const dark = paint(0x2a2f36, 0.6)

	const group = new THREE.Group()
	const parts: { mesh: Mesh; paint: Record<Style, Material>; outline: Mesh }[] = []
	const add = (
		geometry: THREE.BufferGeometry,
		paint: Record<Style, Material>,
		x: number,
		y: number,
		z: number
	) => {
		const mesh = new THREE.Mesh(geometry, paint.realistic)
		mesh.position.set(x, y, z)
		mesh.castShadow = true
		mesh.receiveShadow = true
		group.add(mesh)
		parts.push({ mesh, paint, outline: addOutline(mesh, O) })
	}

	const hull = new THREE.CapsuleGeometry(RADIUS, LENGTH - 2 * RADIUS, 12, 24)
	hull.rotateX(Math.PI / 2)
	add(hull, yellow, 0, 0, 0)
	// conning tower with a short periscope
	add(new THREE.CylinderGeometry(0.06, 0.075, 0.13, 20), yellow, 0, RADIUS + 0.04, 0.08)
	add(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 8), dark, 0, RADIUS + 0.16, 0.1)
	// cross-shaped tail fins
	add(new THREE.BoxGeometry(0.36, 0.015, 0.12), yellow, 0, 0, -0.36)
	add(new THREE.BoxGeometry(0.015, 0.36, 0.12), yellow, 0, 0, -0.36)
	// propeller hub and a porthole on the bow
	add(new THREE.CylinderGeometry(0.035, 0.02, 0.06, 12).rotateX(Math.PI / 2), dark, 0, 0, -0.52)
	add(new THREE.SphereGeometry(0.05, 16, 12), dark, 0, 0.03, 0.44)
	return {
		group,
		setStyle(style: Style) {
			for (const part of parts) {
				part.mesh.material = part.paint[style]
				part.outline.visible = style === 'toon'
			}
		},
	}
}
