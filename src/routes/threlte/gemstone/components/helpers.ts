import * as THREE from 'three'

export function xmur3(str: string) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return (h ^= h >>> 16) >>> 0
  }
}

export function sfc32(a: number, b: number, c: number, d: number) {
  return function () {
    a >>>= 0
    b >>>= 0
    c >>>= 0
    d >>>= 0
    let t = (a + b) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    d = (d + 1) | 0
    t = (t + d) | 0
    c = (c + t) | 0
    return (t >>> 0) / 4294967296
  }
}

export function makeRngFromString(seedStr: string) {
  const seed = xmur3(seedStr)
  return sfc32(seed(), seed(), seed(), seed())
}

export function randUnitVector(rng: () => number) {
  // uniform on sphere
  const u = rng()
  const v = rng()
  const theta = 2 * Math.PI * u
  const z = 2 * v - 1
  const r = Math.sqrt(Math.max(0, 1 - z * z))
  return new THREE.Vector3(r * Math.cos(theta), r * Math.sin(theta), z)
}

// ---------- "Algorithmic carving" (cheap but gem-like) ----------
export function carveGemGeometry(
  seedStr: string,
  opts?: {
    radius?: number
    detail?: number
    cuts?: number
    chipiness?: number
    facetHardness?: number
  }
) {
  const {
    radius = 1.0,
    detail = 4,
    cuts = 26,
    chipiness = 0.015,
    facetHardness = 1.0, // 1 = hard facets, 0 = softer
  } = opts || {}

  const rng = makeRngFromString(seedStr)

  // start from a dense sphere-ish poly
  const geom = new THREE.IcosahedronGeometry(radius, detail)
  const pos = geom.attributes.position
  const p = new THREE.Vector3()

  // carve by projecting vertices back onto many random planes
  for (let i = 0; i < cuts; i++) {
    const n = randUnitVector(rng).normalize()

    // plane offset: closer to radius => smaller stone; closer to center => more aggressive cuts
    const d = radius * (0.25 + 0.55 * rng())

    for (let j = 0; j < pos.count; j++) {
      p.fromBufferAttribute(pos, j)
      const side = p.dot(n) - d
      if (side > 0) {
        // project back to plane: p' = p - n * side
        p.addScaledVector(n, -side * facetHardness)
        pos.setXYZ(j, p.x, p.y, p.z)
      }
    }
  }

  // micro chips / imperfections (tiny radial jitter)
  for (let j = 0; j < pos.count; j++) {
    p.fromBufferAttribute(pos, j)
    const radial = p.clone().normalize()
    const jitter = (rng() - 0.5) * chipiness
    p.addScaledVector(radial, jitter)
    pos.setXYZ(j, p.x, p.y, p.z)
  }

  geom.computeVertexNormals()
  geom.attributes.position.needsUpdate = true
  geom.attributes.normal.needsUpdate = true

  return geom
}
