// =====================================================================
//  ENGINE ADAPTER — Three.js. Chỉ lớp này (và input DOM) biết về Three.js.
//  Lõi dùng hệ trái tay X phải / Y lên / Z trước; Three.js phải tay.
//  Phản chiếu trục Z: pos' = (x, y, −z), quat' = (−x, −y, z, w). Model dựng mũi hướng −Z.
//
//  Dùng với scene bất kỳ: tạo controller, gọi `update(dt)` mỗi frame trước khi render.
//  Controller điều khiển transform của `aircraft.object` và `camera` (camera bám đuôi).
// =====================================================================
import * as THREE from 'three'

import {
	D2R,
	FWD,
	MODES,
	MODE_NAMES,
	PilotController,
	R2D,
	UP,
	add,
	clamp,
	clamp01,
	cloneState,
	createState,
	dot,
	mul,
	norm,
	qAxisAngle,
	qRotate,
	cross,
	stepFlight,
	v3,
	type AircraftConfig,
	type ControlCmd,
	type FlightState,
	type InputEvent,
	type ManeuverId,
	type PilotMessage,
	type PilotMode,
	type Quat,
	type Vec3,
} from '../core'
import type { AircraftRig } from './aircraft-rig'
import { FlightInput, type FlightCommand, type SampledAxes } from './flight-input'
import { VaporTrail } from './vapor-trail'

/** bước physics cố định; hình ảnh được nội suy giữa 2 bước */
const DT = 1 / 120

export const toThreeVec = (p: Vec3, out = new THREE.Vector3()) => out.set(p.x, p.y, -p.z)
export const toThreeQuat = (q: Quat, out = new THREE.Quaternion()) => out.set(-q.x, -q.y, q.z, q.w)
export const fromThreeVec = (p: THREE.Vector3Like) => v3(p.x, p.y, -p.z)
// dùng THREE.Quaternion làm toán trong hệ lõi (handedness không ảnh hưởng phép tính)
const coreQuat = (q: Quat) => new THREE.Quaternion(q.x, q.y, q.z, q.w)
const plainQuat = (q: THREE.Quaternion): Quat => ({ x: q.x, y: q.y, z: q.z, w: q.w })

/** Quaternion (hệ lõi) nhìn theo hướng f, giữ đầu hướng lên */
function lookQuat(f: Vec3) {
	const r = norm(cross(UP, f))
	const u = cross(f, r)
	return new THREE.Quaternion().setFromRotationMatrix(
		new THREE.Matrix4().makeBasis(
			new THREE.Vector3(r.x, r.y, r.z),
			new THREE.Vector3(u.x, u.y, u.z),
			new THREE.Vector3(f.x, f.y, f.z)
		)
	)
}

export type FlightTerrain = {
	/** độ cao mặt đất tại (x, z) theo hệ Three.js */
	heightAt(x: number, z: number): number
	/** có va chạm không (hệ Three.js); mặc định: thấp hơn mặt đất + 1,5 m */
	collides?(p: THREE.Vector3): boolean
}

export type FlightSpawn = {
	/** vị trí theo hệ Three.js */
	position: THREE.Vector3Like
	/** 0° = bay về −Z, 90° = bay về +X */
	headingDeg: number
	/** m/s; mặc định tốc độ cruise của config */
	speed?: number
}

export type ArcadeFlightOptions = {
	scene: THREE.Scene
	camera: THREE.PerspectiveCamera
	/** canvas: click để khoá chuột, lăn chuột chỉnh ga */
	domElement: HTMLElement
	aircraft: AircraftRig
	config: AircraftConfig
	spawn: FlightSpawn
	terrain?: FlightTerrain
	/** màn hình cảm ứng: bỏ mouse-aim, mặc định chế độ Standard */
	touch?: boolean
	mode?: PilotMode
	/** giây chờ trước khi hồi sinh sau va chạm */
	respawnDelay?: number
	trails?: boolean
	shadow?: boolean
	onCrash?: () => void
	onSpawn?: () => void
}

export type ManeuverChip = {
	id: ManeuverId
	name: string
	keys: string
	available: boolean
	cooldown: number
}

/** Ảnh chụp trạng thái để vẽ HUD (plain data, an toàn để đưa vào $state) */
export type FlightHudData = {
	aircraftName: string
	mode: PilotMode
	modeName: string
	speedKmh: number
	altitude: number
	aoaDeg: number
	aoaLevel: 'ok' | 'warn' | 'bad'
	gLoad: number
	gWarn: boolean
	throttle: number
	afterburner: number
	throttleSetting: number
	maneuver: string
	maneuverSub: string
	message: Pick<PilotMessage, 'text' | 'kind'> | null
	warning: '' | 'PULL UP' | 'STALL'
	crashed: boolean
	chips: ManeuverChip[]
	lastEvent: string | null
	combos: { kind: 'CHORD' | 'DOUBLE'; name: string; gapMs: number }[]
}

export const MANEUVER_LABELS: { id: ManeuverId; name: string; keys: string }[] = [
	{ id: 'highG', name: 'High-G', keys: 'Shift+Space+S' },
	{ id: 'cobra', name: 'Cobra', keys: 'Shift+Space→S' },
	{ id: 'kulbit', name: 'Kulbit', keys: 'PSM→giữ S ≥0.7s' },
	{ id: 'jTurn', name: 'J-turn', keys: 'PSM→S+A/D' },
	{ id: 'splitS', name: 'Split-S', keys: 'X' },
	{ id: 'immelmann', name: 'Immelmann', keys: 'C' },
	{ id: 'barrelRoll', name: 'Barrel', keys: 'AA/DD' },
]

export class ArcadeFlightController {
	readonly input: FlightInput
	readonly pilot: PilotController
	readonly camera: THREE.PerspectiveCamera
	config: AircraftConfig
	rig: AircraftRig
	spawn: FlightSpawn
	terrain: FlightTerrain | undefined

	/** trạng thái sim (hệ lõi) ở bước physics mới nhất */
	state: FlightState
	private prevState: FlightState
	/** trạng thái nội suy cho hình ảnh (hệ lõi) */
	private vis: FlightState
	simTime = 0
	crashedAt = -1
	throttleSetting: number
	/** hướng ngắm mouse-aim (hệ lõi) */
	aimDir: Vec3 = v3(0, 0, 1)
	running = false
	lastCmd: ControlCmd = { pitch: 0, roll: 0, yaw: 0, throttle: 0 }

	private scene: THREE.Scene
	private domElement: HTMLElement
	private touch: boolean
	private respawnDelay: number
	private onCrash: (() => void) | undefined
	private onSpawn: (() => void) | undefined
	private acc = 0
	private pending: InputEvent[] = []
	private camRot = new THREE.Quaternion()
	private camDistScale = 1
	private camLock: THREE.Quaternion | null = null
	private camLockIdle = 0
	private trails: VaporTrail[] = []
	private shadow: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial> | null = null
	private ac = new AbortController()
	// scratch
	private tA = new THREE.Vector3()
	private tB = new THREE.Vector3()
	private qa = new THREE.Quaternion()
	private qb = new THREE.Quaternion()
	private tipL = new THREE.Vector3()
	private tipR = new THREE.Vector3()
	private upT = new THREE.Vector3()

	constructor(o: ArcadeFlightOptions) {
		this.scene = o.scene
		this.camera = o.camera
		this.domElement = o.domElement
		this.config = o.config
		this.rig = o.aircraft
		this.spawn = o.spawn
		this.terrain = o.terrain
		this.touch = o.touch ?? false
		this.respawnDelay = o.respawnDelay ?? 2.2
		this.onCrash = o.onCrash
		this.onSpawn = o.onSpawn
		this.pilot = new PilotController(this.config)
		this.pilot.mode = o.mode ?? (this.touch ? 'standard' : 'mouse')
		this.input = new FlightInput({
			wheelTarget: o.domElement,
			touch: this.touch,
			onCommand: (cmd) => this.command(cmd),
		})

		if (o.trails ?? true) {
			this.trails = [new VaporTrail(), new VaporTrail()]
			for (const t of this.trails) this.scene.add(t.mesh)
		}
		if (o.shadow ?? true) {
			this.shadow = new THREE.Mesh(
				new THREE.CircleGeometry(1, 24),
				new THREE.MeshBasicMaterial({
					color: '#000',
					transparent: true,
					opacity: 0.3,
					depthWrite: false,
				})
			)
			this.shadow.rotation.x = -Math.PI / 2
			this.scene.add(this.shadow)
		}
		this.scene.add(this.rig.object)

		this.domElement.addEventListener('click', () => this.requestPointerLock(), {
			signal: this.ac.signal,
		})

		// gán thật trong respawn(); khởi tạo để TS biết chắc đã có giá trị
		this.state = createState(this.config, fromThreeVec(this.spawn.position), 0)
		this.prevState = this.vis = this.state
		this.throttleSetting = this.config.cruiseThrottle
		this.respawn()
	}

	// ---------------- API ----------------

	/** bắt đầu nhận input và chạy sim (gọi từ một cử chỉ người dùng để khoá chuột được) */
	start() {
		this.running = true
		this.input.mouseEnabled = true
		this.requestPointerLock()
	}

	get mode() {
		return this.pilot.mode
	}

	set mode(m: PilotMode) {
		this.pilot.mode = this.touch && m === 'mouse' ? 'standard' : m
		this.aimDir = qRotate(this.state.rot, FWD)
		this.pilot.ap.reset()
		this.pilot.say(`Chế độ: ${MODE_NAMES[this.pilot.mode]}`, this.simTime, 'ok')
		if (this.pilot.mode !== 'mouse' && document.pointerLockElement === this.domElement)
			document.exitPointerLock()
	}

	cycleMode() {
		const i = MODES.indexOf(this.pilot.mode)
		this.mode = MODES[(i + 1) % MODES.length]
	}

	/** đổi máy bay (model + config) và hồi sinh */
	setAircraft(rig: AircraftRig, config: AircraftConfig) {
		this.rig.object.removeFromParent()
		this.rig = rig
		this.scene.add(rig.object)
		this.config = config
		this.respawn()
	}

	/** thay config đang bay (giữ nguyên vị trí / vận tốc) */
	setConfig(config: AircraftConfig) {
		this.config = config
		this.pilot.setConfig(config)
	}

	respawn() {
		const c = this.config
		this.state = createState(
			c,
			fromThreeVec(this.spawn.position),
			this.spawn.headingDeg,
			this.spawn.speed ?? c.speed.cruise
		)
		this.prevState = cloneState(this.state)
		this.vis = this.state
		this.acc = 0
		this.aimDir = qRotate(this.state.rot, FWD)
		this.throttleSetting = c.cruiseThrottle
		this.pilot.setConfig(c)
		this.pilot.ap.reset()
		this.crashedAt = -1
		this.camRot.copy(coreQuat(this.state.rot))
		this.camLock = null
		for (const t of this.trails) t.clear()
		this.onSpawn?.()
	}

	/** hiện thông báo ngắn ở giữa màn hình */
	say(text: string, kind: PilotMessage['kind'] = 'info') {
		this.pilot.say(text, this.simTime, kind)
	}

	get crashed() {
		return this.crashedAt >= 0
	}

	/** vị trí hiển thị (hệ Three.js, đã nội suy) */
	get position(): THREE.Vector3 {
		return this.rig.object.position
	}

	/** độ cao mặt đất tại một điểm hệ lõi */
	groundAt(p: Vec3) {
		return this.terrain ? this.terrain.heightAt(p.x, -p.z) : 0
	}

	/** Gọi mỗi frame trước khi render. `frameDt` tính bằng giây. */
	update(frameDt: number) {
		const ft = Math.min(frameDt, 0.25)
		if (this.running) {
			this.acc += ft
			const axes = this.input.sample(ft, this.config.input)
			// giữ sự kiện tới khi có bước physics để không mất lần nhấn ngắn
			this.pending.push(...this.input.drain())
			while (this.acc >= DT) {
				this.updateAim()
				this.physicsStep(axes, this.pending)
				this.pending = []
				this.acc -= DT
			}
		} else this.input.drain()
		this.updateVisuals(ft)
	}

	/** điểm xa theo mũi, theo hướng bay, và vòng ngắm (hệ Three.js) cho reticle 2D */
	markers(far = 2000) {
		const s = this.vis
		const nose = toThreeVec(add(s.pos, mul(qRotate(s.rot, FWD), far)))
		const fpm = s.speed > 5 ? toThreeVec(add(s.pos, mul(norm(s.vel), far))) : null
		const aim =
			this.pilot.mode === 'mouse' && !this.pilot.aimFollowPlane
				? toThreeVec(add(s.pos, mul(this.aimDir, far)))
				: null
		return { nose, fpm, aim }
	}

	hud(): FlightHudData {
		const s = this.state
		const c = this.config
		const pilot = this.pilot
		const ms = pilot.ms
		const armed = this.simTime < pilot.armedUntil
		const agl = s.pos.y - this.groundAt(s.pos)
		const aoa = s.aoa * R2D
		const tti = s.vel.y < -15 ? agl / -s.vel.y : 99
		const msg = pilot.msg && pilot.msg.until > this.simTime ? pilot.msg : null
		return {
			aircraftName: c.name ?? c.id,
			mode: pilot.mode,
			modeName: MODE_NAMES[pilot.mode],
			speedKmh: Math.round(s.speed * 3.6),
			altitude: Math.round(s.pos.y),
			aoaDeg: aoa,
			aoaLevel:
				Math.abs(aoa) > c.aoa.critical ? 'bad' : Math.abs(aoa) > c.aoa.limiter - 2 ? 'warn' : 'ok',
			gLoad: s.gLoad,
			gWarn: s.gLoad > c.gLimit.pos * 0.95,
			throttle: s.throttle,
			afterburner: s.ab,
			throttleSetting: this.throttleSetting,
			maneuver: ms.active ? ms.active.name : armed ? 'PSM READY' : '',
			maneuverSub: ms.active
				? `${ms.phase === 'active' ? 'ACTIVE' : 'EXIT'} · blend ${ms.w.toFixed(2)}`
				: armed
					? 'kéo S · S+A/D · giữ S'
					: '',
			message: msg ? { text: msg.text, kind: msg.kind } : null,
			warning: tti < 4 && this.crashedAt < 0 ? 'PULL UP' : s.stalled && !ms.active ? 'STALL' : '',
			crashed: this.crashedAt >= 0,
			chips: MANEUVER_LABELS.map(({ id, name, keys }) => ({
				id,
				name,
				keys,
				available:
					!!c.maneuvers?.[id] && ((id !== 'kulbit' && id !== 'jTurn') || c.thrustVectoring),
				cooldown: ms.cooldownLeft(id === 'kulbit' ? 'cobra' : id, this.simTime),
			})),
			lastEvent: pilot.lastEvent,
			combos: this.input.buffer.log.slice(0, 2).map((e) => ({
				kind: e.type === 'chord' ? 'CHORD' : 'DOUBLE',
				name: e.a,
				gapMs: Math.round(e.gap * 1000),
			})),
		}
	}

	dispose() {
		this.ac.abort()
		this.input.dispose()
		for (const t of this.trails) t.dispose()
		if (this.shadow) {
			this.shadow.removeFromParent()
			this.shadow.geometry.dispose()
			this.shadow.material.dispose()
		}
		this.rig.object.removeFromParent()
		if (document.pointerLockElement === this.domElement) document.exitPointerLock()
	}

	// ---------------- nội bộ ----------------

	private command(cmd: FlightCommand) {
		if (cmd.type === 'cycleMode') this.cycleMode()
		else if (cmd.type === 'respawn') this.respawn()
		else this.throttleSetting = clamp(this.throttleSetting + cmd.delta, 0, 1)
	}

	private requestPointerLock() {
		if (!this.running || this.touch || this.pilot.mode !== 'mouse') return
		if (document.pointerLockElement === this.domElement) return
		// trình duyệt có thể từ chối (chưa có cử chỉ người dùng, vừa thoát khoá…): bỏ qua
		this.domElement.requestPointerLock?.()?.catch?.(() => {})
	}

	private collides(p: Vec3) {
		const t = this.terrain
		if (t?.collides) return t.collides(toThreeVec(p, this.tA))
		return p.y < this.groundAt(p) + 1.5
	}

	private updateAim() {
		const [dx, dy] = this.input.consumeMouse()
		if (this.pilot.aimFollowPlane || this.pilot.mode !== 'mouse') {
			this.aimDir = qRotate(this.state.rot, FWD)
			return
		}
		const sens = 0.0022
		let aim = qRotate(qAxisAngle(UP, dx * sens), this.aimDir)
		const right = norm(cross(UP, aim))
		const next = qRotate(qAxisAngle(right, dy * sens), aim)
		if (Math.abs(next.y) < 0.97) aim = next
		this.aimDir = norm(aim)
	}

	private physicsStep(axes: SampledAxes, events: InputEvent[]) {
		this.prevState = cloneState(this.state)
		if (this.crashedAt >= 0) {
			if (this.simTime - this.crashedAt > this.respawnDelay) this.respawn()
			this.simTime += DT
			return
		}
		const agl = this.state.pos.y - this.groundAt(this.state.pos)
		const out = this.pilot.update(
			this.state,
			{
				...axes,
				throttleSetting: this.throttleSetting,
				aimDir: this.pilot.mode === 'mouse' ? this.aimDir : null,
				events,
			},
			DT,
			this.simTime,
			agl
		)
		stepFlight(this.state, this.config, out.cmd, out.mods, DT)
		this.lastCmd = out.cmd
		this.simTime += DT
		if (this.collides(this.state.pos)) {
			this.crashedAt = this.simTime
			this.onCrash?.()
		}
	}

	private updateVisuals(ft: number) {
		const a = this.acc / DT
		const s = this.state
		const p = this.prevState
		const obj = this.rig.object
		obj.position.lerpVectors(toThreeVec(p.pos, this.tA), toThreeVec(s.pos, this.tB), a)
		obj.quaternion.slerpQuaternions(toThreeQuat(p.rot, this.qa), toThreeQuat(s.rot, this.qb), a)
		obj.visible = this.crashedAt < 0
		this.vis = {
			...s,
			pos: v3(
				p.pos.x + (s.pos.x - p.pos.x) * a,
				p.pos.y + (s.pos.y - p.pos.y) * a,
				p.pos.z + (s.pos.z - p.pos.z) * a
			),
		}
		this.updateCamera(this.vis, ft)
		this.rig.animate?.({ state: s, cmd: this.lastCmd, dt: ft })

		// vệt hơi nước đầu cánh khi kéo G cao hoặc AoA lớn
		if (this.trails.length) {
			const vapor = clamp01(
				clamp01((s.gLoad - 3.5) / 3) + clamp01((Math.abs(s.aoa * R2D) - 14) / 15)
			)
			const span = this.rig.span
			this.tipL.set(-span, 0, 0).applyQuaternion(obj.quaternion).add(obj.position)
			this.tipR.set(span, 0, 0).applyQuaternion(obj.quaternion).add(obj.position)
			this.upT.set(0, 1, 0).applyQuaternion(obj.quaternion)
			if (this.running && this.crashedAt < 0) {
				this.trails[0].push(this.tipL, this.upT, 0.15, vapor)
				this.trails[1].push(this.tipR, this.upT, 0.15, vapor)
			}
			for (const t of this.trails) t.update(this.camera.position)
		}

		// bóng đổ giả: chỉ trên nền phẳng, nhạt dần theo độ cao
		if (this.shadow) {
			const gh = this.groundAt(s.pos)
			const agl = s.pos.y - gh
			this.shadow.position.set(obj.position.x, gh + 0.6, obj.position.z)
			this.shadow.scale.setScalar(this.rig.shadowSize * (1 + agl / 800))
			this.shadow.material.opacity = 0.35 * clamp01(1 - agl / 1500)
			this.shadow.visible = gh < 1 && obj.visible
		}
	}

	private updateCamera(s: FlightState, dt: number) {
		const { pilot, camera, rig } = this
		const ms = pilot.ms
		const psm = !!ms.active && (ms.active.id === 'cobra' || ms.active.id === 'jTurn')
		this.camDistScale += ((psm ? 1.7 : 1) - this.camDistScale) * (1 - Math.exp(-dt * 2.5))
		const mouseAim = pilot.mode === 'mouse' && !pilot.aimFollowPlane
		const target = mouseAim ? lookQuat(this.aimDir) : coreQuat(s.rot)
		// Cobra/Kulbit: khoá hướng camera tại thời điểm kích hoạt (vẫn bám vị trí máy bay).
		// Mở khoá khi maneuver đã hết pha active VÀ mũi đã về gần hướng cũ (< 12°), failsafe 2 s.
		const cobraActive = ms.active?.id === 'cobra' && ms.phase === 'active'
		if (cobraActive && !this.camLock) {
			this.camLock = this.camRot.clone()
			this.camLockIdle = 0
		}
		if (this.camLock) {
			const lf = qRotate(plainQuat(this.camLock), FWD)
			const ang = Math.acos(clamp(dot(lf, qRotate(s.rot, FWD)), -1, 1))
			if (!cobraActive) this.camLockIdle += dt
			if ((this.camLockIdle > 0 && ang < 12 * D2R) || this.camLockIdle > 2) this.camLock = null
		}
		const k = mouseAim ? 14 : psm ? 2.2 : 6
		if (this.camLock) this.camRot.copy(this.camLock)
		else this.camRot.slerp(target, 1 - Math.exp(-dt * k))
		const rot = plainQuat(this.camRot)
		const d = rig.camDist * this.camDistScale
		const h = rig.camH * this.camDistScale
		let cp = add(s.pos, qRotate(rot, v3(0, h, -d)))
		if (s.gLoad > 5) {
			const amp = (s.gLoad - 5) * 0.04
			cp = add(cp, v3((Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp, 0))
		}
		const ground = this.groundAt(cp) + 3
		if (cp.y < ground) cp.y = ground
		toThreeVec(cp, camera.position)
		toThreeVec(qRotate(rot, UP), camera.up)
		camera.lookAt(toThreeVec(add(s.pos, qRotate(rot, v3(0, h * 0.45, 60))), this.tA))
		const fov = 60 + clamp01((s.speed - 80) / 420) * 14
		if (Math.abs(camera.fov - fov) > 0.05) {
			camera.fov += (fov - camera.fov) * 0.1
			camera.updateProjectionMatrix()
		}
	}
}
