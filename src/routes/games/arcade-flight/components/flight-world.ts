// Khung cảnh sân tập: bầu trời gradient, nền cỏ, đồi nón, 12 vòng bay, mây instanced.
import * as THREE from 'three'

import type { FlightTerrain } from '#lib/components/arcade-flight/index.js'

import { collidesWithTerrain, createCourse, groundHeightAt, passRings } from './course'

const SKY = new THREE.Color('#9cc7ea')
const RING_IDLE = { color: '#30e07a', emissive: '#0b5a2a' }
const RING_PASSED = { color: '#ffd34a', emissive: '#6a4a00' }

function skyMaterial() {
	return new THREE.ShaderMaterial({
		side: THREE.BackSide,
		depthWrite: false,
		fog: false,
		uniforms: {
			top: { value: new THREE.Color('#3c78c8') },
			mid: { value: SKY.clone() },
			bot: { value: new THREE.Color('#d8e6ee') },
		},
		vertexShader: /* glsl */ `
			varying vec3 vp;
			void main() {
				vp = position;
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}`,
		fragmentShader: /* glsl */ `
			uniform vec3 top, mid, bot;
			varying vec3 vp;
			void main() {
				float h = normalize(vp).y;
				vec3 c = h > 0.0 ? mix(mid, top, pow(h, 0.6)) : mix(mid, bot, clamp(-h * 6.0, 0.0, 1.0));
				gl_FragColor = vec4(c, 1.0);
			}`,
	})
}

function groundTexture(renderer: THREE.WebGLRenderer) {
	const cv = document.createElement('canvas')
	cv.width = cv.height = 256
	const g = cv.getContext('2d')!
	g.fillStyle = '#5f8150'
	g.fillRect(0, 0, 256, 256)
	// vệt đất ngẫu nhiên (chỉ để nhìn, không cần seed)
	for (let i = 0; i < 900; i++) {
		g.fillStyle = `rgba(${40 + Math.random() * 40},${70 + Math.random() * 50},${30 + Math.random() * 30},.35)`
		g.fillRect(Math.random() * 256, Math.random() * 256, 6, 6)
	}
	// lưới ô ruộng giúp cảm nhận tốc độ và độ cao
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
	return tex
}

export function createFlightWorld(renderer: THREE.WebGLRenderer) {
	const course = createCourse()
	const scene = new THREE.Scene()
	scene.fog = new THREE.Fog(SKY, 3000, 22000)

	const sky = new THREE.Mesh(new THREE.SphereGeometry(30000, 32, 16), skyMaterial())
	sky.name = 'sky'
	scene.add(sky)

	// environment map từ chính gradient bầu trời → kim loại PBR của Su-57 có thứ để phản chiếu
	const pmrem = new THREE.PMREMGenerator(renderer)
	const envScene = new THREE.Scene()
	envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyMaterial()))
	const groundDisc = new THREE.Mesh(
		new THREE.CircleGeometry(9, 32).rotateX(-Math.PI / 2).translate(0, -1, 0),
		new THREE.MeshBasicMaterial({ color: '#4f6a43' })
	)
	envScene.add(groundDisc)
	const envMap = pmrem.fromScene(envScene, 0, 0.1, 50).texture
	scene.environment = envMap
	scene.environmentIntensity = 0.8
	pmrem.dispose()
	envScene.traverse((o) => {
		if (o instanceof THREE.Mesh) {
			o.geometry.dispose()
			o.material.dispose()
		}
	})

	scene.add(new THREE.HemisphereLight('#dbefff', '#4c6340', 1.1))
	const sun = new THREE.DirectionalLight('#fff3dc', 2.2)
	sun.position.set(3000, 6000, 2000)
	scene.add(sun)

	const ground = new THREE.Mesh(
		new THREE.PlaneGeometry(60000, 60000),
		new THREE.MeshLambertMaterial({ map: groundTexture(renderer) })
	)
	ground.rotation.x = -Math.PI / 2
	scene.add(ground)

	// vòng bay: torus nằm trong mặt phẳng XY → lookAt theo tiếp tuyến đường vòng
	const ringGeo = new THREE.TorusGeometry(70, 5, 10, 40)
	const ringMeshes = course.rings.map((r) => {
		const m = new THREE.Mesh(ringGeo, new THREE.MeshLambertMaterial(RING_IDLE))
		m.position.copy(r.position)
		m.lookAt(m.position.clone().add(r.tangent))
		scene.add(m)
		return m
	})
	const passed = course.rings.map(() => false)

	const hillMats = ['#6d7f52', '#7a6a4e', '#5d6f47', '#8a8170'].map(
		(color) => new THREE.MeshLambertMaterial({ color, flatShading: true })
	)
	course.hills.forEach((h, i) => {
		const m = new THREE.Mesh(new THREE.ConeGeometry(h.r, h.h, 7, 1), hillMats[i % 4])
		m.position.set(h.x, h.h / 2, h.z)
		m.rotation.y = h.rot
		scene.add(m)
	})

	const clouds = new THREE.InstancedMesh(
		new THREE.IcosahedronGeometry(1, 1),
		new THREE.MeshLambertMaterial({
			color: '#ffffff',
			emissive: '#8e9aa8',
			transparent: true,
			opacity: 0.85,
			depthWrite: false,
		}),
		course.clouds.length
	)
	const o = new THREE.Object3D()
	course.clouds.forEach((c, i) => {
		o.position.copy(c.position)
		o.scale.set(c.scale, c.scale * 0.45, c.scale)
		o.updateMatrix()
		clouds.setMatrixAt(i, o.matrix)
	})
	scene.add(clouds)

	const terrain: FlightTerrain = {
		heightAt: (x, z) => groundHeightAt(course.hills, x, z),
		collides: (p) => collidesWithTerrain(course.hills, p),
	}

	const setRing = (i: number, look: typeof RING_IDLE) => {
		ringMeshes[i].material.color.set(look.color)
		ringMeshes[i].material.emissive.set(look.emissive)
	}

	return {
		scene,
		terrain,
		spawn: course.spawn,
		course,
		ringCount: course.rings.length,
		/** trạng thái đã qua của từng vòng (chỉ đọc, cho mini map) */
		passed: passed as readonly boolean[],
		/** kiểm tra vòng bay qua tại vị trí máy bay; trả về số vòng đã qua */
		updateRings(p: THREE.Vector3) {
			for (const i of passRings(course.rings, passed, p)) setRing(i, RING_PASSED)
			return passed.filter(Boolean).length
		},
		resetRings() {
			passed.fill(false)
			ringMeshes.forEach((_, i) => setRing(i, RING_IDLE))
		},
		dispose() {
			envMap.dispose()
			scene.traverse((obj) => {
				if (!(obj instanceof THREE.Mesh)) return
				obj.geometry.dispose()
				const m = obj.material as THREE.Material & { map?: THREE.Texture | null }
				m.map?.dispose()
				m.dispose()
			})
		},
	}
}

export type FlightWorld = ReturnType<typeof createFlightWorld>
