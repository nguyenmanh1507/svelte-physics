// Sandy seabed mesh. Much larger than the play area so its edge is never visible through the water.
import * as THREE from 'three/webgpu'
import {
	float,
	mix,
	mx_noise_float,
	normalMap,
	positionWorld,
	smoothstep,
	texture,
	vec2,
	vec3,
} from 'three/tsl'
import { underwaterize } from '../water/underwaterize.js'
import { toonUnderwaterize } from '../toon/toonLit'
import type { Style } from '../toon/style'
import type { OceanNodes } from '../toon/types'
import { terrainHeight } from './terrain'

const SIZE = 400
const SEGMENTS = 640
const SAND = '/underwater/textures/coast_sand_01/coast_sand_01'
/** metres covered by one repeat of the sand texture */
const TILE = 3.2

export function buildSeabed(scene: { add(o: unknown): void }, O: OceanNodes) {
	const geometry = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS)
	geometry.rotateX(-Math.PI / 2)
	const pos = geometry.attributes.position
	for (let i = 0; i < pos.count; i++) {
		const x = pos.getX(i)
		const z = pos.getZ(i)
		pos.setXYZ(i, x, terrainHeight(x, z), z)
	}
	geometry.computeVertexNormals()

	const loader = new THREE.TextureLoader()
	const load = (tag: string, srgb: boolean) => {
		const t = loader.load(`${SAND}_${tag}_2k.webp`)
		t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
		t.wrapS = t.wrapT = THREE.RepeatWrapping
		t.anisotropy = 8
		return t
	}
	const uv = positionWorld.xz.div(TILE)
	const arm = texture(load('arm', false), uv)
	const material = new THREE.MeshStandardNodeMaterial()
	material.colorNode = texture(load('diff', true), uv).rgb
	material.roughnessNode = arm.g
	material.metalnessNode = float(0)
	material.aoNode = arm.r
	material.normalNode = normalMap(texture(load('nor_gl', false), uv), vec2(1.2))
	underwaterize(material, O, {
		colorNode: material.colorNode,
		roughnessNode: material.roughnessNode,
	})

	// toon: two flat sand tones in large patches plus sparse darker speckles, no photo texture
	const toon = new THREE.MeshToonNodeMaterial()
	const patch = smoothstep(0.0, 0.04, mx_noise_float(vec3(positionWorld.xz.mul(0.22), 0.5)))
	const speckle = smoothstep(0.62, 0.66, mx_noise_float(vec3(positionWorld.xz.mul(2.6), 4.2)))
	const sand = mix(vec3(0.9, 0.78, 0.55), vec3(0.97, 0.88, 0.66), patch)
	toonUnderwaterize(toon, O, { colorNode: mix(sand, vec3(0.8, 0.66, 0.45), speckle) })

	const materials: Record<Style, THREE.Material> = { realistic: material, toon }
	const mesh = new THREE.Mesh<THREE.BufferGeometry, THREE.Material>(geometry, material)
	mesh.receiveShadow = true
	scene.add(mesh)
	return {
		mesh,
		setStyle(style: Style) {
			mesh.material = materials[style]
		},
	}
}
