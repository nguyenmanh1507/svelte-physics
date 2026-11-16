// =====================================================================
//  ENGINE ADAPTER — Three.js. Chỉ lớp này biết về Three.js.
//  Lõi (FC) dùng hệ trái tay X phải / Y lên / Z trước; Three.js phải tay.
//  Phản chiếu trục Z: pos' = (x, y, -z), quat' = (-x, -y, z, w). Model dựng mũi hướng -Z.
// =====================================================================
import * as THREE from 'three'
const FC = globalThis.FC
const {
	v3,
	add,
	sub,
	mul,
	dot,
	norm,
	len,
	clamp,
	clamp01,
	qRotate,
	qMul,
	qConj,
	qAxisAngle,
	FWD,
	RIGHT,
	UP,
	D2R,
	R2D,
} = FC

const toTV = (p, out = new THREE.Vector3()) => out.set(p.x, p.y, -p.z)
const toTQ = (q, out = new THREE.Quaternion()) => out.set(-q.x, -q.y, q.z, q.w)
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window

// ---------------- renderer / scene ----------------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)
renderer.toneMapping = THREE.ACESFilmicToneMapping
document.body.prepend(renderer.domElement)
const scene = new THREE.Scene()
const SKY = new THREE.Color('#9cc7ea')
scene.fog = new THREE.Fog(SKY, 3000, 22000)
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.5, 40000)

// sky dome gradient
{
	const g = new THREE.SphereGeometry(30000, 32, 16)
	const m = new THREE.ShaderMaterial({
		side: THREE.BackSide,
		depthWrite: false,
		fog: false,
		uniforms: {
			top: { value: new THREE.Color('#3c78c8') },
			mid: { value: new THREE.Color('#9cc7ea') },
			bot: { value: new THREE.Color('#d8e6ee') },
		},
		vertexShader:
			'varying vec3 vp; void main(){ vp = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
		fragmentShader:
			'uniform vec3 top,mid,bot; varying vec3 vp; void main(){ float h = normalize(vp).y; vec3 c = h>0. ? mix(mid, top, pow(h,0.6)) : mix(mid, bot, clamp(-h*6.,0.,1.)); gl_FragColor = vec4(c,1.); }',
	})
	const sky = new THREE.Mesh(g, m)
	sky.name = 'sky'
	scene.add(sky)
}
scene.add(new THREE.HemisphereLight('#dbefff', '#4c6340', 1.1))
const sun = new THREE.DirectionalLight('#fff3dc', 2.2)
sun.position.set(3000, 6000, 2000)
scene.add(sun)

// ground
{
	const cv = document.createElement('canvas')
	cv.width = cv.height = 256
	const g = cv.getContext('2d')
	g.fillStyle = '#5f8150'
	g.fillRect(0, 0, 256, 256)
	for (let i = 0; i < 900; i++) {
		g.fillStyle = `rgba(${40 + Math.random() * 40},${70 + Math.random() * 50},${30 + Math.random() * 30},.35)`
		g.fillRect(Math.random() * 256, Math.random() * 256, 6, 6)
	}
	g.strokeStyle = 'rgba(30,50,25,.55)'
	g.lineWidth = 3
	g.strokeRect(0, 0, 256, 256)
	g.strokeStyle = 'rgba(30,50,25,.25)'
	g.lineWidth = 1
	g.beginPath()
	g.moveTo(128, 0)
	g.lineTo(128, 256)
	g.moveTo(0, 128)
	g.lineTo(256, 128)
	g.stroke()
	const tex = new THREE.CanvasTexture(cv)
	tex.wrapS = tex.wrapT = THREE.RepeatWrapping
	tex.repeat.set(300, 300)
	tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
	tex.colorSpace = THREE.SRGBColorSpace
	const ground = new THREE.Mesh(
		new THREE.PlaneGeometry(60000, 60000),
		new THREE.MeshLambertMaterial({ map: tex })
	)
	ground.rotation.x = -Math.PI / 2
	scene.add(ground)
}

// seeded random
let seed = 7
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647

// rings course
const RING_R = 3500,
	rings = []
{
	const geo = new THREE.TorusGeometry(70, 5, 10, 40)
	for (let i = 0; i < 12; i++) {
		const th = (i / 12) * Math.PI * 2
		const p = v3(RING_R * Math.cos(th), 1300 + 450 * Math.sin(2 * th), RING_R * Math.sin(th))
		const tangent = norm(v3(-Math.sin(th), 0, Math.cos(th)))
		const mat = new THREE.MeshLambertMaterial({ color: '#30e07a', emissive: '#0b5a2a' })
		const m = new THREE.Mesh(geo, mat)
		toTV(p, m.position)
		m.lookAt(toTV(add(p, tangent))) // torus mặt phẳng XY → nhìn theo tiếp tuyến
		scene.add(m)
		rings.push({ p, mesh: m, passed: false })
	}
}

// hills (dùng cho va chạm đơn giản dạng nón)
const hills = []
{
	const mats = ['#6d7f52', '#7a6a4e', '#5d6f47', '#8a8170'].map(
		(c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true })
	)
	let n = 0,
		guard = 0
	while (n < 70 && guard++ < 2000) {
		const x = (rnd() - 0.5) * 26000,
			z = (rnd() - 0.5) * 26000
		const r = 400 + rnd() * 1300,
			h = 250 + rnd() * 1100
		const dCircle = Math.abs(Math.hypot(x, z) - RING_R)
		if (dCircle < r + 700) continue
		const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7, 1), mats[n % 4])
		m.position.set(x, h / 2, -z)
		m.rotation.y = rnd() * 6
		scene.add(m)
		hills.push({ x, z, r, h })
		n++
	}
}
function terrainCollide(p) {
	if (p.y < 1.5) return true
	for (const h of hills) {
		const d = Math.hypot(p.x - h.x, p.z - h.z)
		if (d < h.r && p.y < h.h * (1 - d / h.r)) return true
	}
	return false
}
function groundHeightAt(p) {
	let g = 0
	for (const h of hills) {
		const d = Math.hypot(p.x - h.x, p.z - h.z)
		if (d < h.r) g = Math.max(g, h.h * (1 - d / h.r))
	}
	return g
}

// clouds
{
	const mat = new THREE.MeshLambertMaterial({
		color: '#ffffff',
		emissive: '#8e9aa8',
		transparent: true,
		opacity: 0.85,
		depthWrite: false,
	})
	const geo = new THREE.IcosahedronGeometry(1, 1)
	const inst = new THREE.InstancedMesh(geo, mat, 360)
	const o = new THREE.Object3D()
	let k = 0
	for (let c = 0; c < 60; c++) {
		const cx = (rnd() - 0.5) * 30000,
			cz = (rnd() - 0.5) * 30000,
			cy = 2300 + rnd() * 1500
		for (let j = 0; j < 6; j++) {
			o.position.set(cx + (rnd() - 0.5) * 900, cy + (rnd() - 0.5) * 120, cz + (rnd() - 0.5) * 900)
			const s = 180 + rnd() * 260
			o.scale.set(s, s * 0.45, s)
			o.updateMatrix()
			inst.setMatrixAt(k++, o.matrix)
		}
	}
	scene.add(inst)
}

// ---------------- aircraft models (mũi -Z) ----------------
function M(color, opts = {}) {
	return new THREE.MeshStandardMaterial({
		color,
		roughness: 0.55,
		metalness: 0.25,
		flatShading: true,
		...opts,
	})
}
function mesh(geo, mat, x = 0, y = 0, z = 0) {
	const m = new THREE.Mesh(geo, mat)
	m.position.set(x, y, z)
	return m
}
function wingShape(pts, thick, mat) {
	// pts trên mặt phẳng (x = ngang, z = dọc thân, + là phía trước)
	const s = new THREE.Shape()
	s.moveTo(pts[0][0], -pts[0][1])
	for (const p of pts.slice(1)) s.lineTo(p[0], -p[1])
	const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false })
	g.rotateX(Math.PI / 2)
	g.translate(0, thick / 2, 0)
	return new THREE.Mesh(g, mat)
}
function flame(radius, length) {
	const g = new THREE.ConeGeometry(radius, length, 12, 1, true)
	g.rotateX(Math.PI / 2)
	g.translate(0, 0, length / 2)
	const m = new THREE.Mesh(
		g,
		new THREE.MeshBasicMaterial({
			color: '#ff9a3c',
			transparent: true,
			opacity: 0.85,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
			side: THREE.DoubleSide,
		})
	)
	return m
}
function buildFighter() {
	const g = new THREE.Group(),
		body = M('#7c8a96'),
		dark = M('#3d454d'),
		canopy = M('#1d2a36', { metalness: 0.8, roughness: 0.15 })
	const fus = mesh(new THREE.CylinderGeometry(0.9, 1.3, 15, 10), body, 0, 0, 0)
	fus.rotation.x = Math.PI / 2
	fus.scale.x = 1.5
	g.add(fus)
	const nose = mesh(new THREE.ConeGeometry(0.9, 5, 10), body, 0, 0, -10)
	nose.rotation.x = -Math.PI / 2
	g.add(nose)
	const can = mesh(new THREE.SphereGeometry(0.75, 12, 8), canopy, 0, 0.8, -6)
	can.scale.set(1, 0.8, 2.6)
	g.add(can)
	g.add(
		wingShape(
			[
				[-0.5, 2.5],
				[-7.2, -3.6],
				[-7.2, -5.2],
				[-0.5, -5.2],
			],
			0.25,
			body
		)
	)
	g.add(
		wingShape(
			[
				[0.5, 2.5],
				[7.2, -3.6],
				[7.2, -5.2],
				[0.5, -5.2],
			],
			0.25,
			body
		)
	)
	g.add(
		wingShape(
			[
				[-0.5, -5.5],
				[-3.6, -8.2],
				[-3.6, -9],
				[-0.5, -8.6],
			],
			0.18,
			dark
		)
	)
	g.add(
		wingShape(
			[
				[0.5, -5.5],
				[3.6, -8.2],
				[3.6, -9],
				[0.5, -8.6],
			],
			0.18,
			dark
		)
	)
	for (const sx of [-1, 1]) {
		const fin = wingShape(
			[
				[0, -3.5],
				[0, -7.8],
				[3.6, -8.6],
				[3.6, -6.8],
			],
			0.18,
			dark
		)
		fin.rotation.z = sx > 0 ? Math.PI / 2 - 0.35 : Math.PI / 2 + 0.35
		fin.position.set(sx * 1.4, 0.4, 0)
		fin.rotation.order = 'ZXY'
		g.add(fin)
		const noz = mesh(
			new THREE.CylinderGeometry(0.62, 0.55, 1.4, 10, 1, true),
			dark,
			sx * 0.9,
			-0.1,
			8.1
		)
		noz.rotation.x = Math.PI / 2
		g.add(noz)
	}
	const fl = [flame(0.5, 5), flame(0.5, 5)]
	fl[0].position.set(-0.9, -0.1, 8.7)
	fl[1].position.set(0.9, -0.1, 8.7)
	g.add(...fl)
	g.userData = { flames: fl, span: 7.2, camDist: 30, camH: 7.5, shadow: 12 }
	return g
}
function buildAerobatic() {
	const g = new THREE.Group(),
		red = M('#d23b2f'),
		white = M('#f1efe9'),
		dark = M('#262a2e')
	const fus = mesh(new THREE.CylinderGeometry(0.45, 0.25, 6, 10), white, 0, 0, 0.6)
	fus.rotation.x = Math.PI / 2
	g.add(fus)
	const cowl = mesh(new THREE.CylinderGeometry(0.55, 0.5, 1.6, 12), red, 0, 0, -2.9)
	cowl.rotation.x = Math.PI / 2
	g.add(cowl)
	const can = mesh(
		new THREE.SphereGeometry(0.42, 10, 8),
		M('#1d2a36', { metalness: 0.8, roughness: 0.15 }),
		0,
		0.42,
		-0.6
	)
	can.scale.set(1, 0.9, 2)
	g.add(can)
	g.add(mesh(new THREE.BoxGeometry(7.6, 0.14, 1.5), red, 0, -0.2, -1.2))
	g.add(mesh(new THREE.BoxGeometry(2.8, 0.1, 0.8), red, 0, 0.05, 3.3))
	g.add(mesh(new THREE.BoxGeometry(0.1, 1.2, 0.9), white, 0, 0.6, 3.4))
	const prop = new THREE.Group()
	prop.position.set(0, 0, -3.8)
	prop.add(mesh(new THREE.BoxGeometry(2.0, 0.16, 0.05), dark))
	prop.add(mesh(new THREE.BoxGeometry(0.16, 2.0, 0.05), dark))
	prop.add(mesh(new THREE.ConeGeometry(0.22, 0.5, 10), red, 0, 0, -0.2))
	prop.children[2].rotation.x = -Math.PI / 2
	g.add(prop)
	g.userData = { props: [prop], span: 3.8, camDist: 15, camH: 3.4, shadow: 6 }
	return g
}
function buildTransport() {
	const g = new THREE.Group(),
		grey = M('#8d9a86'),
		dark = M('#4b5547')
	const fus = mesh(new THREE.CylinderGeometry(2.2, 2.2, 24, 12), grey, 0, 0, 0)
	fus.rotation.x = Math.PI / 2
	g.add(fus)
	const nose = mesh(
		new THREE.SphereGeometry(2.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
		grey,
		0,
		0,
		-12
	)
	nose.rotation.x = -Math.PI / 2
	nose.scale.y = 1.4
	g.add(nose)
	const tail = mesh(new THREE.ConeGeometry(2.2, 8, 12), grey, 0, 0.8, 16)
	tail.rotation.x = Math.PI / 2
	g.add(tail)
	g.add(mesh(new THREE.BoxGeometry(40, 0.5, 4.2), grey, 0, 2.2, -2))
	g.add(mesh(new THREE.BoxGeometry(14, 0.3, 3), grey, 0, 1.6, 18))
	g.add(mesh(new THREE.BoxGeometry(0.4, 7, 4.5), grey, 0, 5, 18))
	const props = []
	for (const x of [-14, -7, 7, 14]) {
		const pod = mesh(new THREE.CylinderGeometry(0.8, 0.7, 5, 10), dark, x, 1.6, -3.2)
		pod.rotation.x = Math.PI / 2
		g.add(pod)
		const pr = new THREE.Group()
		pr.position.set(x, 1.6, -6)
		pr.add(mesh(new THREE.BoxGeometry(4.2, 0.25, 0.06), dark))
		pr.add(mesh(new THREE.BoxGeometry(0.25, 4.2, 0.06), dark))
		g.add(pr)
		props.push(pr)
	}
	g.userData = { props, span: 20, camDist: 80, camH: 18, shadow: 36 }
	return g
}
const BUILDERS = { fighter: buildFighter, aerobatic: buildAerobatic, transport: buildTransport }

// wingtip vapor ribbon
class Trail {
	constructor(n = 90) {
		this.n = n
		this.pts = []
		this.geo = new THREE.BufferGeometry()
		this.pos = new Float32Array(n * 2 * 3)
		this.col = new Float32Array(n * 2 * 4)
		this.geo.setAttribute(
			'position',
			new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage)
		)
		this.geo.setAttribute(
			'color',
			new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage)
		)
		const idx = []
		for (let i = 0; i < n - 1; i++) {
			const a = i * 2
			idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
		}
		this.geo.setIndex(idx)
		this.mesh = new THREE.Mesh(
			this.geo,
			new THREE.MeshBasicMaterial({
				vertexColors: true,
				transparent: true,
				depthWrite: false,
				side: THREE.DoubleSide,
				fog: true,
			})
		)
		this.mesh.frustumCulled = false
		scene.add(this.mesh)
	}
	push(p, up, w, alpha) {
		this.pts.unshift({ p: p.clone(), up: up.clone().multiplyScalar(w), a: alpha })
		if (this.pts.length > this.n) this.pts.pop()
	}
	update(dt) {
		const cp = camera.position
		for (let i = 0; i < this.n; i++) {
			const q = this.pts[i] ?? this.pts[this.pts.length - 1]
			if (!q) continue
			const near = clamp01((q.p.distanceTo(cp) - 8) / 45) // mờ dần khi đi qua gần camera
			const a = this.pts[i] ? q.a * (1 - i / this.n) * near * 0.6 : 0
			this.pos.set(
				[
					q.p.x + q.up.x,
					q.p.y + q.up.y,
					q.p.z + q.up.z,
					q.p.x - q.up.x,
					q.p.y - q.up.y,
					q.p.z - q.up.z,
				],
				i * 6
			)
			this.col.set([1, 1, 1, a * 0.7, 1, 1, 1, a * 0.7], i * 8)
		}
		this.geo.attributes.position.needsUpdate = true
		this.geo.attributes.color.needsUpdate = true
	}
	clear() {
		this.pts.length = 0
	}
}
const trails = [new Trail(), new Trail()]

const shadow = new THREE.Mesh(
	new THREE.CircleGeometry(1, 24),
	new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.3, depthWrite: false })
)
shadow.rotation.x = -Math.PI / 2
scene.add(shadow)

// ---------------- game state ----------------
const DEFAULT_CFG = JSON.parse(JSON.stringify(FC.CONFIGS))
const configs = JSON.parse(JSON.stringify(FC.CONFIGS))
let acKey = 'fighter',
	cfg = configs[acKey],
	model = null
let state,
	prevState,
	pilot = new FC.PilotController(cfg)
pilot.mode = isTouch ? 'standard' : 'mouse'
let aimDir = v3(0, 0, 1),
	simTime = 0,
	crashedAt = -1,
	throttleSetting = cfg.cruiseThrottle
const camRot = new THREE.Quaternion()
let camDistScale = 1,
	camLock = null,
	camLockIdle = 0

function spawn() {
	const th = -25 * D2R
	const pos = v3(RING_R * Math.cos(th), 1500, RING_R * Math.sin(th))
	state = FC.createState(cfg, pos, 25, cfg.speed.cruise)
	prevState = FC.cloneState(state)
	aimDir = qRotate(state.rot, FWD)
	throttleSetting = cfg.cruiseThrottle
	pilot.setConfig(cfg)
	pilot.ap.reset()
	crashedAt = -1
	camRot.copy(coreQuat(state.rot))
	camLock = null
	trails.forEach((t) => t.clear())
	rings.forEach((r) => {
		r.passed = false
		r.mesh.material.color.set('#30e07a')
	})
	document.getElementById('crash').style.display = 'none'
}
const coreQuat = (q) => new THREE.Quaternion(q.x, q.y, q.z, q.w) // dùng THREE.Quaternion làm toán trong hệ lõi (handedness không ảnh hưởng phép tính)

function setAircraft(k) {
	acKey = k
	cfg = configs[k]
	if (model) scene.remove(model)
	model = BUILDERS[k]()
	scene.add(model)
	spawn()
	refreshCfgPanel()
	updateButtons()
}

// ---------------- input adapter ----------------
const buf = new FC.InputBuffer({
	chords: [{ name: 'boost+brake', keys: ['boost', 'brake'] }],
	chordWindow: 0.12,
})
const keys = new Set()
const KEYMAP = {
	KeyA: 'rollL',
	KeyD: 'rollR',
	KeyQ: 'yawL',
	KeyE: 'yawR',
	ShiftLeft: 'boost',
	ShiftRight: 'boost',
	Space: 'brake',
	KeyV: 'arm',
	KeyX: 'splitS',
	KeyC: 'immelmann',
	KeyW: 'pitchDown',
	KeyS: 'pitchUp',
}
const nowS = () => performance.now() / 1000
const evT = (e) => (e.timeStamp > 0 ? e.timeStamp / 1000 : nowS()) // thời điểm OS tạo sự kiện → đo chord/double-tap chính xác dù frame chậm
const typing = (e) => e.target && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT')
addEventListener('keydown', (e) => {
	if (typing(e)) return
	if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault()
	if (e.repeat) return
	keys.add(e.code)
	const a = KEYMAP[e.code]
	if (a) buf.press(a, evT(e))
	if (e.code === 'KeyM') cycleMode()
	if (e.code === 'Digit1') setAircraft('fighter')
	if (e.code === 'Digit2') setAircraft('aerobatic')
	if (e.code === 'Digit3') setAircraft('transport')
	if (e.code === 'KeyR') spawn()
	if (e.code === 'KeyH') toggle('help')
	if (e.code === 'KeyP') toggle('cfg')
	if (e.code === 'BracketRight') throttleSetting = clamp(throttleSetting + 0.1, 0, 1)
	if (e.code === 'BracketLeft') throttleSetting = clamp(throttleSetting - 0.1, 0, 1)
})
addEventListener('keyup', (e) => {
	keys.delete(e.code)
	const a = KEYMAP[e.code]
	if (a) buf.release(a, evT(e))
})
addEventListener('blur', () => {
	for (const k of keys) {
		const a = KEYMAP[k]
		if (a) buf.release(a, nowS())
	}
	keys.clear()
})
const kPitch = new FC.KeyAxis(4, 7),
	kRoll = new FC.KeyAxis(5, 8),
	kYaw = new FC.KeyAxis(3, 6)

let mouseDX = 0,
	mouseDY = 0
addEventListener('mousemove', (e) => {
	if (started && !isTouch) {
		mouseDX += e.movementX
		mouseDY += e.movementY
	}
})
addEventListener(
	'wheel',
	(e) => {
		throttleSetting = clamp(throttleSetting - Math.sign(e.deltaY) * 0.05, 0, 1)
	},
	{ passive: true }
)
renderer.domElement.addEventListener('click', () => {
	if (pilot.mode === 'mouse' && !isTouch)
		renderer.domElement.requestPointerLock?.()?.catch?.(() => {})
})

// gamepad
const padPrev = []
function pollGamepad(t) {
	const pads = navigator.getGamepads ? navigator.getGamepads() : []
	const p = [...pads].find((x) => x && x.connected)
	if (!p) return null
	const btn = (i) => (p.buttons[i] ? p.buttons[i].value > 0.5 : false)
	const map = {
		7: 'boost',
		6: 'brake',
		4: 'yawL',
		5: 'yawR',
		0: 'arm',
		2: 'splitS',
		3: 'immelmann',
	}
	for (const [i, a] of Object.entries(map)) {
		const d = btn(+i)
		if (d && !padPrev[i]) buf.press(a, t)
		if (!d && padPrev[i]) buf.release(a, t)
		padPrev[i] = d
	}
	if (btn(8) && !padPrev[8]) cycleMode()
	padPrev[8] = btn(8)
	if (btn(9) && !padPrev[9]) spawn()
	padPrev[9] = btn(9)
	let [x, y] = FC.scaledRadial(p.axes[0] || 0, p.axes[1] || 0, cfg.input.deadzone)
	return { roll: FC.expo(x, cfg.input.expo), pitch: FC.expo(y, cfg.input.expo) }
}

// touch
const touch = { x: 0, y: 0 }
if (isTouch) {
	document.body.classList.add('touch')
	document.getElementById('touch').classList.add('show')
	document.getElementById('touchNote').style.display = 'block'
	const stick = document.getElementById('stick'),
		knob = document.getElementById('knob')
	let sid = null
	const move = (e) => {
		const r = stick.getBoundingClientRect()
		let dx = (e.clientX - r.left - r.width / 2) / (r.width / 2),
			dy = (e.clientY - r.top - r.height / 2) / (r.height / 2)
		const m = Math.hypot(dx, dy)
		if (m > 1) {
			dx /= m
			dy /= m
		}
		touch.x = dx
		touch.y = dy
		knob.style.transform = `translate(${dx * 47}px,${dy * 47}px)`
	}
	stick.addEventListener('pointerdown', (e) => {
		sid = e.pointerId
		stick.setPointerCapture(sid)
		move(e)
	})
	stick.addEventListener('pointermove', (e) => {
		if (e.pointerId === sid) move(e)
	})
	const end = (e) => {
		if (e.pointerId === sid) {
			sid = null
			touch.x = touch.y = 0
			knob.style.transform = ''
		}
	}
	stick.addEventListener('pointerup', end)
	stick.addEventListener('pointercancel', end)
	document.querySelectorAll('#tbtns button').forEach((b) => {
		const a = b.dataset.t
		b.addEventListener('pointerdown', (e) => {
			e.preventDefault()
			b.setPointerCapture(e.pointerId)
			if (a === 'mode') cycleMode()
			else if (a === 'reset') spawn()
			else if (a === 'rollL' || a === 'rollR') {
				const t = nowS()
				buf.press(a, t)
				buf.release(a, t)
				buf.press(a, t + 0.01)
			} else buf.press(a, nowS())
		})
		const up = () => {
			if (a !== 'mode' && a !== 'reset') buf.release(a, nowS())
		}
		b.addEventListener('pointerup', up)
		b.addEventListener('pointercancel', up)
	})
}

function sampleRaw(dt) {
	const t = nowS()
	const pad = pollGamepad(t)
	let pitch = kPitch.update(
		keys.has('KeyW') || keys.has('ArrowUp'),
		keys.has('KeyS') || keys.has('ArrowDown'),
		dt
	)
	let roll = kRoll.update(
		keys.has('KeyA') || keys.has('ArrowLeft'),
		keys.has('KeyD') || keys.has('ArrowRight'),
		dt
	)
	let yaw = kYaw.update(keys.has('KeyQ'), keys.has('KeyE'), dt)
	if (pad) {
		pitch += pad.pitch
		roll += pad.roll
	}
	if (isTouch) {
		const [x, y] = FC.scaledRadial(touch.x, touch.y, 0.12)
		pitch += FC.expo(y, 0.4)
		roll += FC.expo(x, 0.4)
	}
	if (buf.isDown('yawL')) yaw -= keys.has('KeyQ') ? 0 : 1
	if (buf.isDown('yawR')) yaw += keys.has('KeyE') ? 0 : 1
	return {
		pitch: clamp(pitch, -1, 1),
		roll: clamp(roll, -1, 1),
		yaw: clamp(yaw, -1, 1),
		boost: buf.isDown('boost'),
		brake: buf.isDown('brake'),
		throttleSetting,
		aimDir: pilot.mode === 'mouse' ? aimDir : null,
	}
}

function updateAim() {
	if (pilot.aimFollowPlane || pilot.mode !== 'mouse') {
		aimDir = qRotate(state.rot, FWD)
		mouseDX = mouseDY = 0
		return
	}
	const sens = 0.0022
	aimDir = qRotate(qAxisAngle(UP, mouseDX * sens), aimDir)
	const right = norm(FC.cross(UP, aimDir))
	const next = qRotate(qAxisAngle(right, mouseDY * sens), aimDir)
	if (Math.abs(next.y) < 0.97) aimDir = next
	aimDir = norm(aimDir)
	mouseDX = mouseDY = 0
}

function cycleMode() {
	const i = FC.MODES.indexOf(pilot.mode)
	pilot.mode = FC.MODES[(i + 1) % FC.MODES.length]
	if (isTouch && pilot.mode === 'mouse') pilot.mode = 'standard'
	aimDir = qRotate(state.rot, FWD)
	pilot.ap.reset()
	pilot.say(`Chế độ: ${FC.MODE_NAMES[pilot.mode]}`, simTime, 'ok')
	if (pilot.mode !== 'mouse' && document.pointerLockElement) document.exitPointerLock()
	updateButtons()
}

// ---------------- UI ----------------
const $ = (id) => document.getElementById(id)
function toggle(id) {
	const el = $(id),
		show = !el.classList.contains('show')
	document.querySelectorAll('.side').forEach((s) => s.classList.remove('show'))
	if (show) el.classList.add('show')
	updateButtons()
}
function updateButtons() {
	document
		.querySelectorAll('[data-ac]')
		.forEach((b) => b.classList.toggle('on', b.dataset.ac === acKey))
	$('bMode').textContent = `M · ${FC.MODE_NAMES[pilot.mode]}`
	$('bHelp').classList.toggle('on', $('help').classList.contains('show'))
	$('bCfg').classList.toggle('on', $('cfg').classList.contains('show'))
}
document
	.querySelectorAll('[data-ac]')
	.forEach((b) => b.addEventListener('click', () => setAircraft(b.dataset.ac)))
$('bMode').onclick = cycleMode
$('bHelp').onclick = () => toggle('help')
$('bCfg').onclick = () => toggle('cfg')
function refreshCfgPanel() {
	$('cfgText').value = JSON.stringify(cfg, null, 2)
	$('cfgErr').textContent = ''
	const d = FC.derived(cfg),
		kmh = (v) => (v ? Math.round(v * 3.6) + ' km/h' : '—')
	$('cfgDerived').innerHTML =
		`Suy ra: corner speed (curve ∩ G) ≈ ${kmh(d.cornerFromCurve)} · (lift) ≈ ${kmh(d.cornerFromLift)} · Vmax AB ≈ ${kmh(d.vMaxAB)}`
}
$('cfgApply').onclick = () => {
	try {
		const c = JSON.parse($('cfgText').value)
		configs[acKey] = c
		cfg = c
		pilot.setConfig(c)
		refreshCfgPanel()
		pilot.say('Đã áp dụng config', simTime, 'ok')
	} catch (e) {
		$('cfgErr').textContent = 'JSON lỗi: ' + e.message
	}
}
$('cfgReset').onclick = () => {
	configs[acKey] = JSON.parse(JSON.stringify(DEFAULT_CFG[acKey]))
	cfg = configs[acKey]
	pilot.setConfig(cfg)
	refreshCfgPanel()
}
$('cfgCopy').onclick = async () => {
	try {
		await navigator.clipboard.writeText($('cfgText').value)
		$('cfgErr').textContent = 'Đã copy.'
	} catch {
		$('cfgErr').textContent = 'Trình duyệt chặn clipboard — hãy chọn và copy thủ công.'
	}
}
let started = false
$('go').onclick = () => {
	started = true
	$('start').style.display = 'none'
	if (pilot.mode === 'mouse' && !isTouch)
		renderer.domElement.requestPointerLock?.()?.catch?.(() => {})
}

const MAN_LABEL = {
	highG: ['High-G', 'Shift+Space+S'],
	cobra: ['Cobra', 'Shift+Space→S'],
	kulbit: ['Kulbit', 'PSM→giữ S ≥0.7s'],
	jTurn: ['J-turn', 'PSM→S+A/D'],
	splitS: ['Split-S', 'X'],
	immelmann: ['Immelmann', 'C'],
	barrelRoll: ['Barrel', 'AA/DD'],
}
function renderChips() {
	const html = Object.entries(MAN_LABEL)
		.map(([id, [n, k]]) => {
			const has =
				!!cfg.maneuvers?.[id] && ((id !== 'kulbit' && id !== 'jTurn') || cfg.thrustVectoring)
			const cd = pilot.ms.cooldownLeft(id === 'kulbit' ? 'cobra' : id, simTime)
			return `<span class="chip ${!has ? 'off' : cd > 0 ? 'cd' : ''}">${n} <span style="opacity:.6">${k}</span>${has && cd > 0 ? ' ' + cd.toFixed(1) + 's' : ''}</span>`
		})
		.join('')
	if ($('chips').innerHTML !== html) $('chips').innerHTML = html
}

// 2D overlay: nose cross, aim circle, flight-path marker
const ov = $('overlay2d'),
	og = ov.getContext('2d')
function resize() {
	renderer.setSize(innerWidth, innerHeight)
	camera.aspect = innerWidth / innerHeight
	camera.updateProjectionMatrix()
	ov.width = innerWidth * devicePixelRatio
	ov.height = innerHeight * devicePixelRatio
}
addEventListener('resize', resize)
resize()
function project(pCore) {
	const v = toTV(pCore).project(camera)
	if (v.z > 1) return null
	return [((v.x + 1) / 2) * innerWidth, ((1 - v.y) / 2) * innerHeight]
}
function drawOverlay(s) {
	og.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
	og.clearRect(0, 0, innerWidth, innerHeight)
	og.strokeStyle = 'rgba(125,255,176,.9)'
	og.lineWidth = 1.5
	og.fillStyle = 'rgba(125,255,176,.9)'
	const far = 2000
	const nose = project(add(s.pos, mul(qRotate(s.rot, FWD), far)))
	if (nose) {
		const [x, y] = nose
		og.beginPath()
		og.moveTo(x - 10, y)
		og.lineTo(x - 3, y)
		og.moveTo(x + 3, y)
		og.lineTo(x + 10, y)
		og.moveTo(x, y - 10)
		og.lineTo(x, y - 3)
		og.moveTo(x, y + 3)
		og.lineTo(x, y + 10)
		og.stroke()
	}
	const fpm = s.speed > 5 ? project(add(s.pos, mul(norm(s.vel), far))) : null
	if (fpm) {
		const [x, y] = fpm
		og.beginPath()
		og.arc(x, y, 6, 0, 7)
		og.moveTo(x - 14, y)
		og.lineTo(x - 6, y)
		og.moveTo(x + 6, y)
		og.lineTo(x + 14, y)
		og.moveTo(x, y - 6)
		og.lineTo(x, y - 12)
		og.stroke()
	}
	if (pilot.mode === 'mouse' && !pilot.aimFollowPlane) {
		const aim = project(add(s.pos, mul(aimDir, far)))
		if (aim) {
			og.strokeStyle = 'rgba(255,255,255,.85)'
			og.beginPath()
			og.arc(aim[0], aim[1], 16, 0, 7)
			og.stroke()
			og.beginPath()
			og.arc(aim[0], aim[1], 2, 0, 7)
			og.fill()
		}
	}
}

// ---------------- camera ----------------
function lookQuat(f) {
	const r = norm(FC.cross(UP, f)),
		u = FC.cross(f, r)
	return new THREE.Quaternion().setFromRotationMatrix(
		new THREE.Matrix4().makeBasis(
			new THREE.Vector3(r.x, r.y, r.z),
			new THREE.Vector3(u.x, u.y, u.z),
			new THREE.Vector3(f.x, f.y, f.z)
		)
	)
}
function updateCamera(s, dt) {
	const ud = model.userData,
		psm = pilot.ms.active && ['cobra', 'jTurn'].includes(pilot.ms.active.id)
	camDistScale += ((psm ? 1.7 : 1) - camDistScale) * (1 - Math.exp(-dt * 2.5))
	let target
	if (pilot.mode === 'mouse' && !pilot.aimFollowPlane) target = lookQuat(aimDir)
	else target = coreQuat(s.rot)
	// Cobra/Kulbit: khoá hướng camera tại thời điểm kích hoạt (vẫn bám vị trí máy bay).
	// Mở khoá khi maneuver đã hết pha active VÀ mũi máy bay đã về gần hướng cũ (< 12°), có failsafe 2 s.
	const ms = pilot.ms,
		isCobra = ms.active && ms.active.id === 'cobra'
	if (isCobra && ms.phase === 'active' && !camLock) {
		camLock = camRot.clone()
		camLockIdle = 0
	}
	if (camLock) {
		const lf = qRotate({ x: camLock.x, y: camLock.y, z: camLock.z, w: camLock.w }, FWD)
		const ang = Math.acos(clamp(dot(lf, qRotate(s.rot, FWD)), -1, 1))
		if (!(isCobra && ms.phase === 'active')) camLockIdle += dt
		if ((camLockIdle > 0 && ang < 12 * D2R) || camLockIdle > 2) camLock = null
	}
	const k = pilot.mode === 'mouse' && !pilot.aimFollowPlane ? 14 : psm ? 2.2 : 6
	if (camLock) camRot.copy(camLock)
	else camRot.slerp(target, 1 - Math.exp(-dt * k))
	const rot = { x: camRot.x, y: camRot.y, z: camRot.z, w: camRot.w }
	const d = ud.camDist * camDistScale,
		h = ud.camH * camDistScale
	let cp = add(s.pos, qRotate(rot, v3(0, h, -d)))
	if (s.gLoad > 5) {
		const a = (s.gLoad - 5) * 0.04
		cp = add(cp, v3((Math.random() - 0.5) * a, (Math.random() - 0.5) * a, 0))
	}
	const ground = groundHeightAt(cp) + 3
	if (cp.y < ground) cp.y = ground
	toTV(cp, camera.position)
	toTV(qRotate(rot, UP), camera.up)
	camera.lookAt(toTV(add(s.pos, qRotate(rot, v3(0, h * 0.45, 60)))))
	const fov = 60 + clamp01((s.speed - 80) / 420) * 14
	if (Math.abs(camera.fov - fov) > 0.05) {
		camera.fov += (fov - camera.fov) * 0.1
		camera.updateProjectionMatrix()
	}
}

// ---------------- HUD ----------------
function updateHUD(s, agl) {
	$('hAircraft').textContent = cfg.name ?? cfg.id
	$('hMode').textContent = FC.MODE_NAMES[pilot.mode]
	$('hSpd').textContent = Math.round(s.speed * 3.6) + ' km/h'
	$('hAlt').textContent = Math.round(s.pos.y) + ' m'
	const aoa = s.aoa * R2D
	$('hAoA').textContent = aoa.toFixed(1) + '°'
	$('hAoA').style.color =
		Math.abs(aoa) > cfg.aoa.critical
			? 'var(--bad)'
			: Math.abs(aoa) > cfg.aoa.limiter - 2
				? 'var(--warn)'
				: ''
	$('hG').textContent = s.gLoad.toFixed(1)
	$('hG').style.color = s.gLoad > cfg.gLimit.pos * 0.95 ? 'var(--warn)' : ''
	$('hThr').textContent = Math.round(s.throttle * 100) + '%' + (s.ab > 0.1 ? ' AB' : '')
	$('hThrBar').style.width = s.throttle * 100 + '%'
	$('hAbBar').style.width = s.ab * 100 + '%'
	$('hThrSet').style.left = throttleSetting * 100 + '%'
	$('hRings').textContent = rings.filter((r) => r.passed).length + '/' + rings.length
	const ms = pilot.ms,
		armed = simTime < pilot.armedUntil
	$('bMan').textContent = ms.active ? ms.active.name : armed ? 'PSM READY' : ''
	$('bSub').textContent = ms.active
		? `${ms.phase === 'active' ? 'ACTIVE' : 'EXIT'} · blend ${ms.w.toFixed(2)}`
		: armed
			? 'kéo S · S+A/D · giữ S'
			: ''
	const m = pilot.msg && pilot.msg.until > simTime ? pilot.msg : null
	$('msg').style.display = m ? 'block' : 'none'
	if (m) {
		$('msg').textContent = m.text
		$('msg').className = 'hud ' + m.kind
	}
	let w = ''
	const tti = s.vel.y < -15 ? agl / -s.vel.y : 99
	if (tti < 4 && crashedAt < 0) w = 'PULL UP'
	else if (s.stalled && !ms.active) w = 'STALL'
	$('warn').textContent = w
	const log = buf.log
		.slice(0, 2)
		.map(
			(e) =>
				`<b>${e.type === 'chord' ? 'CHORD' : 'DOUBLE'}</b> ${e.a} ${Math.round(e.gap * 1000)}ms`
		)
		.join(' · ')
	$('combo').innerHTML =
		`Input: ${pilot.lastEvent ? `<b>${pilot.lastEvent}</b>` : '—'}${log ? ' · ' + log : ''}`
	renderChips()
}

// ---------------- main loop: fixed timestep + interpolation ----------------
const DT = 1 / 120
let pendingEvents = [],
	acc = 0,
	last = performance.now() / 1000,
	hudTimer = 0,
	propAng = 0
const iPos = new THREE.Vector3(),
	qa = new THREE.Quaternion(),
	qb = new THREE.Quaternion()
const tipL = new THREE.Vector3(),
	tipR = new THREE.Vector3(),
	upT = new THREE.Vector3()

function physicsStep(raw, events) {
	prevState = FC.cloneState(state)
	if (crashedAt >= 0) {
		if (simTime - crashedAt > 2.2) spawn()
		simTime += DT
		return
	}
	const agl = state.pos.y - groundHeightAt(state.pos)
	const out = pilot.update(state, { ...raw, events }, DT, simTime, agl)
	FC.stepFlight(state, cfg, out.cmd, out.mods, DT)
	simTime += DT
	for (const r of rings)
		if (!r.passed && len(sub(state.pos, r.p)) < 75) {
			r.passed = true
			r.mesh.material.color.set('#ffd34a')
			r.mesh.material.emissive.set('#6a4a00')
		}
	if (terrainCollide(state.pos)) {
		crashedAt = simTime
		$('crash').style.display = 'block'
	}
}

function frame() {
	const now = performance.now() / 1000
	const ft = Math.min(now - last, 0.25)
	last = now
	if (started) {
		acc += ft
		const raw = sampleRaw(ft)
		pendingEvents.push(...buf.drain()) // giữ sự kiện tới khi có bước physics để không mất lần nhấn ngắn
		while (acc >= DT) {
			updateAim()
			physicsStep(raw, pendingEvents)
			pendingEvents = []
			acc -= DT
		}
	}
	const a = acc / DT,
		s = state,
		p = prevState
	iPos.lerpVectors(toTV(p.pos), toTV(s.pos), a)
	qa.copy(toTQ(p.rot))
	qb.copy(toTQ(s.rot))
	model.position.copy(iPos)
	model.quaternion.slerpQuaternions(qa, qb, a)
	model.visible = crashedAt < 0
	// hiển thị state nội suy cho camera
	const vis = {
		...s,
		pos: {
			x: p.pos.x + (s.pos.x - p.pos.x) * a,
			y: p.pos.y + (s.pos.y - p.pos.y) * a,
			z: p.pos.z + (s.pos.z - p.pos.z) * a,
		},
	}
	updateCamera(vis, ft)
	// juice: afterburner, props, vapor, shadow
	const ud = model.userData
	if (ud.flames)
		ud.flames.forEach((f) => {
			const k = 0.25 + s.throttle * 0.5 + s.ab * 1.3
			f.scale.set(0.6 + s.ab * 0.5, 0.6 + s.ab * 0.5, k * (0.9 + Math.random() * 0.2))
			f.material.color.set(s.ab > 0.2 ? '#ffb15a' : '#ff6a2a')
			f.material.opacity = 0.25 + s.ab * 0.6
		})
	if (ud.props) {
		propAng += ft * (20 + s.throttle * 60)
		ud.props.forEach((pr) => (pr.rotation.z = propAng))
	}
	const vapor = clamp01((s.gLoad - 3.5) / 3) + clamp01((Math.abs(s.aoa * R2D) - 14) / 15)
	tipL.set(-ud.span, 0, 0).applyQuaternion(model.quaternion).add(model.position)
	tipR.set(ud.span, 0, 0).applyQuaternion(model.quaternion).add(model.position)
	upT.set(0, 1, 0).applyQuaternion(model.quaternion)
	if (started && crashedAt < 0) {
		trails[0].push(tipL, upT, 0.15, clamp01(vapor))
		trails[1].push(tipR, upT, 0.15, clamp01(vapor))
	}
	trails.forEach((t) => t.update(ft))
	const gh = groundHeightAt(s.pos)
	const agl = s.pos.y - gh
	shadow.position.set(iPos.x, gh + 0.6, iPos.z)
	const ss = ud.shadow * (1 + agl / 800)
	shadow.scale.set(ss, ss, ss)
	shadow.material.opacity = 0.35 * clamp01(1 - agl / 1500)
	shadow.visible = gh < 1
	renderer.render(scene, camera)
	drawOverlay(vis)
	hudTimer += ft
	if (hudTimer > 0.05) {
		hudTimer = 0
		updateHUD(s, agl)
	}
	requestAnimationFrame(frame)
}

setAircraft('fighter')
updateButtons()
window.__game = {
	get state() {
		return state
	},
	get pilot() {
		return pilot
	},
	buf,
	setAircraft,
	spawn,
	start: () => $('go').click(),
	keys,
	KEYMAP,
	nowS,
}
requestAnimationFrame(frame)
