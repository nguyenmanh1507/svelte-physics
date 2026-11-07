import * as THREE from 'three'
import { bottom, pondT, randomInPond, smooth } from './terrain'

// Steering behaviors của Buckland (Programming Game AI by Example, ch.3):
// wander, arrive (tới viên thức ăn), flee (tránh chỗ vừa khuấy), separation, tránh bờ và cuống sen.

export interface Food {
	x: number
	z: number
	vx: number
	vz: number
}

export interface KoiState {
	length: number
	pos: THREE.Vector3
	vel: THREE.Vector2 // trên mặt phẳng XZ: (x, z)
	wander: THREE.Vector2
	yaw: number
	depthPref: number
	maxSpeed: number
	phase: number // pha quẫy đuôi
	swimAmp: number // biên độ quẫy đuôi
	flee: number // giây còn lại phải chạy trốn
	fleeFrom: THREE.Vector2
	target: Food | null
}

export interface SteerWorld {
	fishes: KoiState[]
	food: Food[]
	obstacles: { x: number; z: number }[]
	drop: (x: number, z: number, amp: number, radius: number) => void
	rand?: () => number
}

export function createKoiState(length: number, rand: () => number = Math.random): KoiState {
	const p = randomInPond(0.3, rand)
	const a = rand() * Math.PI * 2
	return {
		length,
		pos: new THREE.Vector3(p.x, -0.22, p.z),
		vel: new THREE.Vector2(Math.cos(a), Math.sin(a)).multiplyScalar(0.1),
		wander: new THREE.Vector2(1, 0).rotateAround(new THREE.Vector2(), rand() * Math.PI * 2),
		yaw: -a,
		depthPref: -0.18 - rand() * 0.15,
		maxSpeed: 0.16 + rand() * 0.08,
		phase: rand() * 6,
		swimAmp: 0.02,
		flee: 0,
		fleeFrom: new THREE.Vector2(),
		target: null,
	}
}

// Làm cả đàn hoảng chạy khỏi (x, z) trong `seconds` giây
export function scare(fishes: KoiState[], x: number, z: number, seconds: number) {
	for (const f of fishes) {
		f.flee = seconds
		f.fleeFrom.set(x, z)
	}
}

const tmp = new THREE.Vector2()
const desired = new THREE.Vector2()
const force = new THREE.Vector2()
const heading = new THREE.Vector2()
const p = new THREE.Vector2()

export function steerKoi(f: KoiState, world: SteerWorld, dt: number) {
	const rand = world.rand ?? Math.random
	const v = f.vel
	p.set(f.pos.x, f.pos.z)
	const speed = v.length()
	if (speed > 1e-4) heading.copy(v).divideScalar(speed)
	else heading.set(1, 0)
	force.set(0, 0)

	// wander: lắc một điểm trên vòng tròn chiếu phía trước con cá
	f.wander.x += (rand() - 0.5) * 2.4 * dt
	f.wander.y += (rand() - 0.5) * 2.4 * dt
	f.wander.normalize()
	desired
		.copy(heading)
		.multiplyScalar(0.5)
		.addScaledVector(f.wander, 0.28)
		.normalize()
		.multiplyScalar(f.maxSpeed * 0.7)
	force.addScaledVector(desired.sub(v), 0.8)

	// arrive: tới viên thức ăn gần nhất
	f.target = null
	let best = 3.0
	for (const fd of world.food) {
		const d = Math.hypot(fd.x - p.x, fd.z - p.y)
		if (d < best) {
			best = d
			f.target = fd
		}
	}
	if (f.target) {
		tmp.set(f.target.x - p.x, f.target.z - p.y)
		const d = tmp.length(),
			sp = Math.min(f.maxSpeed * 1.7, d * 1.4)
		desired.copy(tmp).divideScalar(Math.max(d, 1e-4)).multiplyScalar(sp)
		force.addScaledVector(desired.sub(v), 2.4)
	}

	// flee: chạy khỏi chỗ vừa có sỏi rơi / bị khuấy
	if (f.flee > 0) {
		tmp.copy(p).sub(f.fleeFrom)
		const d = tmp.length()
		if (d < 1.4) {
			desired
				.copy(tmp)
				.divideScalar(Math.max(d, 1e-3))
				.multiplyScalar(f.maxSpeed * 2.6)
			force.addScaledVector(desired.sub(v), 3.0 * (1.4 - d))
		}
		f.flee -= dt
	}

	// separation
	for (const o of world.fishes) {
		if (o === f) continue
		tmp.set(p.x - o.pos.x, p.y - o.pos.z)
		const d = tmp.length()
		if (d < 0.38 && d > 1e-4) force.addScaledVector(tmp, 0.05 / (d * d))
	}

	// ở lại chỗ nước sâu: nhìn trước một đoạn, gặp chỗ nông thì quay về giữa ao
	const ax = p.x + heading.x * 0.6,
		az = p.y + heading.y * 0.6
	const shallow = smooth(0.3, 0.12, -bottom(ax, az))
	if (shallow > 0) force.addScaledVector(tmp.set(-ax, -az).normalize(), shallow * 1.4)
	const tp = pondT(p.x, p.y)
	if (tp > 0.75) force.addScaledVector(tmp.set(-p.x, -p.y).normalize(), (tp - 0.75) * 6)

	// cuống sen là vật cản
	for (const o of world.obstacles) {
		tmp.set(p.x - o.x, p.y - o.z)
		const d = tmp.length()
		if (d < 0.16 && d > 1e-4) force.addScaledVector(tmp, 0.02 / (d * d))
	}

	const fl = force.length(),
		maxF = 0.9
	if (fl > maxF) force.multiplyScalar(maxF / fl)
	v.addScaledVector(force, dt)
	const lim = f.maxSpeed * (f.target ? 1.7 : 1) * (f.flee > 0 ? 2.6 : 1)
	const sp2 = v.length()
	if (sp2 > lim) v.multiplyScalar(lim / sp2)
	if (sp2 < 0.03) v.multiplyScalar(0.03 / Math.max(sp2, 1e-5))
	f.pos.x += v.x * dt
	f.pos.z += v.y * dt

	// độ sâu: thỉnh thoảng đổi tầng bơi, ngoi lên khi sắp đớp mồi
	const floor = bottom(f.pos.x, f.pos.z) + 0.06
	if (rand() < dt * 0.15) f.depthPref = -0.12 - rand() * 0.3
	let ty = f.target && best < 0.8 ? -0.05 : f.depthPref
	ty = Math.min(-0.05, Math.max(floor, ty))
	f.pos.y += (ty - f.pos.y) * Math.min(1, dt * 1.2)

	// đớp mồi
	if (f.target && best < f.length * 0.35 && f.pos.y > -0.09) {
		world.food.splice(world.food.indexOf(f.target), 1)
		world.drop(f.target.x, f.target.z, -0.01, 0.07)
		f.target = null
	}

	// hướng thân và nhịp quẫy đuôi
	const yawT = Math.atan2(-v.y, v.x)
	let dy = yawT - f.yaw
	dy = Math.atan2(Math.sin(dy), Math.cos(dy))
	f.yaw += dy * Math.min(1, dt * 5)
	const spNow = v.length()
	f.phase += dt * (5 + spNow * 32)
	f.swimAmp = f.length * (0.06 + spNow * 0.25) + Math.abs(dy) * 0.02

	// bơi sát mặt nước thì làm gợn nhẹ
	if (f.pos.y > -0.08 && rand() < dt * 0.6) world.drop(f.pos.x, f.pos.z, -0.0025, 0.06)
}
