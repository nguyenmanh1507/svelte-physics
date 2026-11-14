// Toon outlines as an inverted hull: a back-face copy of the mesh, pushed out along smoothed normals. Being scene
// geometry it is fogged with distance and refracted by the water surface like everything else, with no extra pass.
import * as THREE from 'three/webgpu'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import {
	cameraPosition,
	length,
	modelWorldMatrix,
	normalGeometry,
	positionGeometry,
	vec4,
} from 'three/tsl'
import type { Material, Mesh, OceanNodes } from './types'

/** outline width as a fraction of the distance to the camera (constant on screen) */
const WIDTH = 0.0032
/** but never thicker than this in metres, so close-ups keep thin lines */
const MAX_WIDTH = 0.012

// one material for every outline in the scene
const shared: { material?: Material } = {}

function outlineMaterial(O: OceanNodes) {
	if (shared.material) return shared.material
	const material = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide })
	const world = modelWorldMatrix.mul(vec4(positionGeometry, 1)).xyz
	const width = length(cameraPosition.sub(world)).mul(WIDTH).min(MAX_WIDTH)
	material.positionNode = positionGeometry.add(normalGeometry.mul(width))
	// near-black navy, scaled by the scene's ambient level
	material.colorNode = O.U.ambient.mul(0.06)
	shared.material = material
	return material
}

/**
 * Add an outline shell as a child of `mesh` (hidden until a toon style shows it). Normals are averaged across
 * coincident vertices first, otherwise hard edges split the shell open.
 */
export function addOutline(mesh: Mesh, O: OceanNodes) {
	const source = mesh.geometry.clone()
	for (const name of Object.keys(source.attributes))
		if (name !== 'position') source.deleteAttribute(name)
	const geometry = mergeVertices(source, 1e-4)
	geometry.computeVertexNormals()
	const shell = new THREE.Mesh(geometry, outlineMaterial(O))
	shell.visible = false
	shell.castShadow = false
	shell.receiveShadow = false
	mesh.add(shell)
	return shell
}
