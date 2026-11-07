import * as THREE from 'three'
import { COMMON, under, worldMaterial, type PondUniforms } from './shading'
import { bottom, GROUND, hash2, pondR } from './terrain'

// Bầu trời, đáy ao + bãi cỏ, vòng đất ở xa, đá trên bờ.

const TERRAIN_SIZE = 14
const TERRAIN_SEGMENTS = 240

export function createSky(uniforms: PondUniforms) {
	const sky = new THREE.Mesh(
		new THREE.SphereGeometry(80, 32, 16),
		new THREE.ShaderMaterial({
			uniforms,
			side: THREE.BackSide,
			depthWrite: false,
			vertexShader: /* glsl */ `varying vec3 vP; void main(){ vP = (modelMatrix * vec4(position,1.)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vP,1.); }`,
			fragmentShader:
				COMMON +
				/* glsl */ `varying vec3 vP; void main(){ gl_FragColor = vec4(skyColor(vP - cameraPosition), 1.0); }`,
		})
	)
	// bám theo camera nên không bao giờ bị cắt
	sky.frustumCulled = false
	sky.renderOrder = -1
	return sky
}

function terrainMaterial(uniforms: PondUniforms) {
	return worldMaterial(
		uniforms,
		/* glsl */ `
void main(){
  vec3 n = normalize(vN);
  vec3 col;
  if (vPos.y < 0.012) {
    // đáy ao: bùn + sỏi (voronoi)
    vec2 g = vPos.xz * 16.0; vec2 ip = floor(g), fp = fract(g); float md = 1.0; vec2 cell = vec2(0.0);
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y)); vec2 h = hash22(ip + o);
      float dd = length(o + h * 0.8 + 0.1 - fp); if (dd < md) { md = dd; cell = ip + o; } }
    float rnd = hash12(cell);
    float pebble = smoothstep(0.42, 0.30, md) * step(0.35, rnd);
    vec3 mud = mix(vec3(0.40, 0.34, 0.24), vec3(0.50, 0.44, 0.32), vnoise(vPos.xz * 3.0));
    vec3 stone = mix(vec3(0.55, 0.52, 0.46), vec3(0.36, 0.33, 0.30), hash12(cell + 7.1));
    col = mix(mud, stone, pebble);
    col *= mix(0.85, 1.0, smoothstep(-0.55, -0.1, vPos.y));
  } else {
    float nz = vnoise(vPos.xz * 6.0) * 0.6 + vnoise(vPos.xz * 23.0) * 0.4;
    vec3 grass = mix(vec3(0.27, 0.42, 0.16), vec3(0.42, 0.55, 0.22), nz);
    vec3 dirt = vec3(0.36, 0.29, 0.20);
    col = mix(dirt, grass, smoothstep(0.02, 0.07, vPos.y + nz * 0.02));
  }
  col = lit(col, n, vPos);
  float f = smoothstep(9.0, 40.0, length(vPos.xz));
  gl_FragColor = vec4(mix(col, vec3(0.62, 0.70, 0.60), f), 1.0);
}`
	)
}

export function createGround(uniforms: PondUniforms) {
	const group = new THREE.Group()
	const material = terrainMaterial(uniforms)

	const geometry = new THREE.PlaneGeometry(
		TERRAIN_SIZE,
		TERRAIN_SIZE,
		TERRAIN_SEGMENTS,
		TERRAIN_SEGMENTS
	)
	geometry.rotateX(-Math.PI / 2)
	const p = geometry.attributes.position
	for (let i = 0; i < p.count; i++) {
		const x = p.getX(i),
			z = p.getZ(i)
		p.setY(i, Math.max(Math.abs(x), Math.abs(z)) > 6.6 ? GROUND : bottom(x, z))
	}
	geometry.computeVertexNormals()
	group.add(under(new THREE.Mesh(geometry, material)))

	// vòng đất phẳng ở xa, khoét lỗ đúng bằng mảnh địa hình
	const s = new THREE.Shape()
	s.moveTo(-80, -80)
	s.lineTo(80, -80)
	s.lineTo(80, 80)
	s.lineTo(-80, 80)
	s.lineTo(-80, -80)
	const hsz = TERRAIN_SIZE / 2 - 0.05
	const hole = new THREE.Path()
	hole.moveTo(-hsz, -hsz)
	hole.lineTo(-hsz, hsz)
	hole.lineTo(hsz, hsz)
	hole.lineTo(hsz, -hsz)
	hole.lineTo(-hsz, -hsz)
	s.holes.push(hole)
	const ring = new THREE.ShapeGeometry(s)
	ring.rotateX(-Math.PI / 2)
	ring.translate(0, GROUND - 0.003, 0)
	group.add(new THREE.Mesh(ring, material))
	return group
}

export function createBankRocks(uniforms: PondUniforms) {
	const group = new THREE.Group()
	const material = worldMaterial(
		uniforms,
		/* glsl */ `
void main(){ vec3 n = normalize(vN);
  vec3 c = mix(vec3(0.50, 0.49, 0.45), vec3(0.62, 0.60, 0.55), vnoise(vPos.xz * 9.0 + vPos.y * 5.0));
  c = mix(c, vec3(0.32, 0.42, 0.20), smoothstep(0.55, 0.85, n.y) * step(0.0, vPos.y) * vnoise(vPos.xz * 14.0));
  gl_FragColor = vec4(lit(c, n, vPos), 1.0); }`
	)
	for (let i = 0; i < 14; i++) {
		const th = (i / 14) * Math.PI * 2 + hash2(i, 3) * 0.3
		if (th > 4.0 && th < 5.0) continue // chừa một khoảng bờ trống
		const R = pondR(th) * (1.0 + hash2(i, 1) * 0.08),
			s = 0.14 + hash2(i, 2) * 0.22
		const g = new THREE.DodecahedronGeometry(1, 1)
		const p = g.attributes.position
		for (let j = 0; j < p.count; j++) {
			const f = 0.85 + 0.3 * hash2(p.getX(j) * 3 + i, p.getZ(j) * 3)
			p.setXYZ(j, p.getX(j) * f, p.getY(j) * f * 0.6, p.getZ(j) * f)
		}
		g.computeVertexNormals()
		const m = new THREE.Mesh(g, material)
		m.scale.setScalar(s)
		m.position.set(Math.cos(th) * R, GROUND - s * 0.15, Math.sin(th) * R)
		m.rotation.y = hash2(i, 9) * 6.28
		group.add(under(m))
	}
	return group
}
