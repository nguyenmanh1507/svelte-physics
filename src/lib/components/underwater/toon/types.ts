// Bí danh kiểu cho các module TSL. Mã gốc được viết khi chưa có kiểu của three; kiểu TSL của @types/three
// quá chặt cho cách dùng node tự do ở đây (vec3 ⇄ color, VarNode ⇄ Node), nên Node cố ý để là any.
import type * as THREE from 'three/webgpu'
import type { makeOceanNodes } from '../water/ocean/oceanNodes.js'

/** a TSL shader node */
export type Node = any
/** node material with the hooks toonUnderwaterize sets (emissiveNode only exists on lit materials) */
export type Material = THREE.NodeMaterial & { emissiveNode?: Node }
export type Mesh = THREE.Mesh
export type Texture = THREE.Texture
/** the shared wave function and underwater optics (water/ocean/oceanNodes.js) */
// the shape comes from the untyped JS module; its members are TSL nodes, so they are typed as Node
export type OceanNodes = {
	[K in keyof ReturnType<typeof makeOceanNodes>]: K extends 'U' ? Record<string, Node> : Node
}
