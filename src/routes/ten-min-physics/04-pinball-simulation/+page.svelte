<script lang="ts">
	import { onMount } from 'svelte'

	class Vector2 {
		x: number
		y: number

		constructor(x = 0, y = 0) {
			this.x = x
			this.y = y
		}

		set(v: Vector2) {
			this.x = v.x
			this.y = v.y
		}

		clone() {
			return new Vector2(this.x, this.y)
		}

		add(v: Vector2, s = 1) {
			this.x += v.x * s
			this.y += v.y * s
			return this
		}

		addVectors(a: Vector2, b: Vector2) {
			this.x = a.x + b.x
			this.y = a.y + b.y
			return this
		}

		subtract(v: Vector2, s = 1) {
			this.x -= v.x * s
			this.y -= v.y * s
			return this
		}

		subtractVectors(a: Vector2, b: Vector2) {
			this.x = a.x - b.x
			this.y = a.y - b.y
			return this
		}

		length() {
			return Math.sqrt(this.x * this.x + this.y * this.y)
		}

		scale(s: number) {
			this.x *= s
			this.y *= s
			return this
		}

		dot(v: Vector2) {
			return this.x * v.x + this.y * v.y
		}

		perp() {
			return new Vector2(-this.y, this.x)
		}
	}

	class Ball {
		radius: number
		mass: number
		restitution: number
		pos: Vector2
		vel: Vector2

		constructor(radius: number, mass: number, pos: Vector2, vel: Vector2, restitution: number) {
			this.radius = radius
			this.mass = mass
			this.restitution = restitution
			this.pos = pos.clone()
			this.vel = vel.clone()
		}

		simulate(dt: number, gravity: Vector2) {
			this.vel.add(gravity, dt)
			this.pos.add(this.vel, dt)
		}
	}

	class Obstacle {
		radius: number
		pos: Vector2
		pushVel: number

		constructor(radius: number, pos: Vector2, pushVel: number) {
			this.radius = radius
			this.pos = pos.clone()
			this.pushVel = pushVel
		}
	}

	class Flipper {
		radius: number
		pos: Vector2
		length: number
		restAngle: number
		maxRotation: number
		sign: number
		angularVelocity: number
		restitution: number
		rotation: number
		currentAngularVelocity: number
		touchIdentifier: number

		constructor(
			radius: number,
			pos: Vector2,
			length: number,
			restAngle: number,
			maxRotation: number,
			angularVelocity: number,
			restitution: number
		) {
			this.radius = radius
			this.pos = pos.clone()
			this.length = length
			this.restAngle = restAngle
			this.maxRotation = Math.abs(maxRotation)
			this.sign = Math.sign(maxRotation)
			this.angularVelocity = angularVelocity
			this.restitution = restitution
			this.rotation = 0
			this.currentAngularVelocity = 0
			this.touchIdentifier = -1
		}

		simulate(dt: number) {
			const prevRotation = this.rotation
			const pressed = this.touchIdentifier >= 0

			if (pressed) {
				this.rotation = Math.min(this.rotation + dt * this.angularVelocity, this.maxRotation)
			} else {
				this.rotation = Math.max(this.rotation - dt * this.angularVelocity, 0)
			}

			this.currentAngularVelocity = (this.sign * (this.rotation - prevRotation)) / dt
		}

		select(pos: Vector2) {
			const d = new Vector2()
			d.subtractVectors(this.pos, pos)
			return d.length() < this.length
		}

		getTip() {
			const angle = this.restAngle + this.sign * this.rotation
			const dir = new Vector2(Math.cos(angle), Math.sin(angle))
			const tip = this.pos.clone()
			return tip.add(dir, this.length)
		}
	}

	type PhysicsScene = {
		gravity: Vector2
		dt: number
		score: number
		paused: boolean
		border: Vector2[]
		balls: Ball[]
		obstacles: Obstacle[]
		flippers: Flipper[]
	}

	let canvasRef: HTMLCanvasElement | undefined
	let canvasContainerRef: HTMLDivElement | undefined
	let score = 0
	let restart = () => {}

	function closestPointOnSegment(p: Vector2, a: Vector2, b: Vector2) {
		const ab = new Vector2()
		ab.subtractVectors(b, a)
		let t = ab.dot(ab)

		if (t === 0) {
			return a.clone()
		}

		t = Math.max(0, Math.min(1, (p.dot(ab) - a.dot(ab)) / t))
		const closest = a.clone()
		return closest.add(ab, t)
	}

	onMount(() => {
		const canvas = canvasRef
		const container = canvasContainerRef

		if (!canvas || !container) {
			return
		}

		const context = canvas.getContext('2d')

		if (!context) {
			return
		}

		const flipperHeight = 1.7
		let cScale = 1
		let simHeight = 0
		let animationFrameId = 0

		const physicsScene: PhysicsScene = {
			gravity: new Vector2(0, -3),
			dt: 1 / 60,
			score: 0,
			paused: false,
			border: [],
			balls: [],
			obstacles: [],
			flippers: [],
		}

		const resizeCanvas = () => {
			canvas.width = Math.max(1, container.clientWidth)
			canvas.height = Math.max(1, container.clientHeight)
			cScale = canvas.height / flipperHeight
			simHeight = canvas.height / cScale
		}

		const cX = (pos: Vector2) => pos.x * cScale
		const cY = (pos: Vector2) => canvas.height - pos.y * cScale

		const setupScene = () => {
			const offset = 0.02
			physicsScene.score = 0
			score = 0
			physicsScene.border = []
			physicsScene.balls = []
			physicsScene.obstacles = []
			physicsScene.flippers = []

			physicsScene.border.push(new Vector2(0.74, 0.25))
			physicsScene.border.push(new Vector2(1 - offset, 0.4))
			physicsScene.border.push(new Vector2(1 - offset, flipperHeight - offset))
			physicsScene.border.push(new Vector2(offset, flipperHeight - offset))
			physicsScene.border.push(new Vector2(offset, 0.4))
			physicsScene.border.push(new Vector2(0.26, 0.25))
			physicsScene.border.push(new Vector2(0.26, 0))
			physicsScene.border.push(new Vector2(0.74, 0))

			{
				const radius = 0.03
				const mass = Math.PI * radius * radius
				let pos = new Vector2(0.92, 0.5)
				let vel = new Vector2(-0.2, 3.5)
				physicsScene.balls.push(new Ball(radius, mass, pos, vel, 0.2))

				pos = new Vector2(0.08, 0.5)
				vel = new Vector2(0.2, 3.5)
				physicsScene.balls.push(new Ball(radius, mass, pos, vel, 0.2))
			}

			physicsScene.obstacles.push(new Obstacle(0.1, new Vector2(0.25, 0.6), 2))
			physicsScene.obstacles.push(new Obstacle(0.1, new Vector2(0.75, 0.5), 2))
			physicsScene.obstacles.push(new Obstacle(0.12, new Vector2(0.7, 1), 2))
			physicsScene.obstacles.push(new Obstacle(0.1, new Vector2(0.2, 1.2), 2))

			{
				const radius = 0.03
				const length = 0.2
				const maxRotation = 1
				const restAngle = 0.5
				const angularVelocity = 10
				const restitution = 0
				const pos1 = new Vector2(0.26, 0.22)
				const pos2 = new Vector2(0.74, 0.22)

				physicsScene.flippers.push(
					new Flipper(radius, pos1, length, -restAngle, maxRotation, angularVelocity, restitution)
				)
				physicsScene.flippers.push(
					new Flipper(
						radius,
						pos2,
						length,
						Math.PI + restAngle,
						-maxRotation,
						angularVelocity,
						restitution
					)
				)
			}
		}

		const drawDisc = (x: number, y: number, radius: number) => {
			context.beginPath()
			context.arc(x, y, radius, 0, 2 * Math.PI)
			context.closePath()
			context.fill()
		}

		const draw = () => {
			context.clearRect(0, 0, canvas.width, canvas.height)

			if (physicsScene.border.length >= 2) {
				context.strokeStyle = '#000000'
				context.lineWidth = 5
				context.beginPath()

				let v = physicsScene.border[0]
				context.moveTo(cX(v), cY(v))

				for (let i = 1; i < physicsScene.border.length + 1; i++) {
					v = physicsScene.border[i % physicsScene.border.length]
					context.lineTo(cX(v), cY(v))
				}

				context.stroke()
				context.lineWidth = 1
			}

			context.fillStyle = '#202020'
			for (const ball of physicsScene.balls) {
				drawDisc(cX(ball.pos), cY(ball.pos), ball.radius * cScale)
			}

			context.fillStyle = '#FF8000'
			for (const obstacle of physicsScene.obstacles) {
				drawDisc(cX(obstacle.pos), cY(obstacle.pos), obstacle.radius * cScale)
			}

			context.fillStyle = '#FF0000'
			for (const flipper of physicsScene.flippers) {
				context.translate(cX(flipper.pos), cY(flipper.pos))
				context.rotate(-flipper.restAngle - flipper.sign * flipper.rotation)
				context.fillRect(
					0,
					-flipper.radius * cScale,
					flipper.length * cScale,
					2 * flipper.radius * cScale
				)
				drawDisc(0, 0, flipper.radius * cScale)
				drawDisc(flipper.length * cScale, 0, flipper.radius * cScale)
				context.resetTransform()
			}
		}

		const handleBallBallCollision = (ball1: Ball, ball2: Ball) => {
			const restitution = Math.min(ball1.restitution, ball2.restitution)
			const dir = new Vector2()
			dir.subtractVectors(ball2.pos, ball1.pos)
			const d = dir.length()

			if (d === 0 || d > ball1.radius + ball2.radius) {
				return
			}

			dir.scale(1 / d)

			const corr = (ball1.radius + ball2.radius - d) / 2
			ball1.pos.add(dir, -corr)
			ball2.pos.add(dir, corr)

			const v1 = ball1.vel.dot(dir)
			const v2 = ball2.vel.dot(dir)
			const m1 = ball1.mass
			const m2 = ball2.mass

			const newV1 = (m1 * v1 + m2 * v2 - m2 * (v1 - v2) * restitution) / (m1 + m2)
			const newV2 = (m1 * v1 + m2 * v2 - m1 * (v2 - v1) * restitution) / (m1 + m2)

			ball1.vel.add(dir, newV1 - v1)
			ball2.vel.add(dir, newV2 - v2)
		}

		const handleBallObstacleCollision = (ball: Ball, obstacle: Obstacle) => {
			const dir = new Vector2()
			dir.subtractVectors(ball.pos, obstacle.pos)
			const d = dir.length()

			if (d === 0 || d > ball.radius + obstacle.radius) {
				return
			}

			dir.scale(1 / d)

			const corr = ball.radius + obstacle.radius - d
			ball.pos.add(dir, corr)

			const v = ball.vel.dot(dir)
			ball.vel.add(dir, obstacle.pushVel - v)

			physicsScene.score += 1
			score = physicsScene.score
		}

		const handleBallFlipperCollision = (ball: Ball, flipper: Flipper) => {
			const closest = closestPointOnSegment(ball.pos, flipper.pos, flipper.getTip())
			const dir = new Vector2()
			dir.subtractVectors(ball.pos, closest)
			const d = dir.length()

			if (d === 0 || d > ball.radius + flipper.radius) {
				return
			}

			dir.scale(1 / d)

			const corr = ball.radius + flipper.radius - d
			ball.pos.add(dir, corr)

			const radius = closest.clone()
			radius.add(dir, flipper.radius)
			radius.subtract(flipper.pos)

			const surfaceVel = radius.perp()
			surfaceVel.scale(flipper.currentAngularVelocity)

			const v = ball.vel.dot(dir)
			const nextVelocity = surfaceVel.dot(dir)
			ball.vel.add(dir, nextVelocity - v)
		}

		const handleBallBorderCollision = (ball: Ball, border: Vector2[]) => {
			if (border.length < 3) {
				return
			}

			const d = new Vector2()
			const closest = new Vector2()
			const ab = new Vector2()
			let normal = new Vector2()
			let minDist = 0

			for (let i = 0; i < border.length; i++) {
				const a = border[i]
				const b = border[(i + 1) % border.length]
				const c = closestPointOnSegment(ball.pos, a, b)
				d.subtractVectors(ball.pos, c)
				const dist = d.length()

				if (i === 0 || dist < minDist) {
					minDist = dist
					closest.set(c)
					ab.subtractVectors(b, a)
					normal = ab.perp()
				}
			}

			d.subtractVectors(ball.pos, closest)
			let dist = d.length()

			if (dist === 0) {
				d.set(normal)
				dist = normal.length()
			}

			d.scale(1 / dist)

			if (d.dot(normal) >= 0) {
				if (dist > ball.radius) {
					return
				}

				ball.pos.add(d, ball.radius - dist)
			} else {
				ball.pos.add(d, -(dist + ball.radius))
			}

			const v = ball.vel.dot(d)
			const nextVelocity = Math.abs(v) * ball.restitution
			ball.vel.add(d, nextVelocity - v)
		}

		const simulate = () => {
			for (const flipper of physicsScene.flippers) {
				flipper.simulate(physicsScene.dt)
			}

			for (let i = 0; i < physicsScene.balls.length; i++) {
				const ball = physicsScene.balls[i]
				ball.simulate(physicsScene.dt, physicsScene.gravity)

				for (let j = i + 1; j < physicsScene.balls.length; j++) {
					handleBallBallCollision(ball, physicsScene.balls[j])
				}

				for (const obstacle of physicsScene.obstacles) {
					handleBallObstacleCollision(ball, obstacle)
				}

				for (const flipper of physicsScene.flippers) {
					handleBallFlipperCollision(ball, flipper)
				}

				handleBallBorderCollision(ball, physicsScene.border)
			}
		}

		const update = () => {
			if (!physicsScene.paused) {
				simulate()
				draw()
			}

			animationFrameId = requestAnimationFrame(update)
		}

		const getPointerPos = (clientX: number, clientY: number) => {
			const rect = canvas.getBoundingClientRect()
			return new Vector2((clientX - rect.left) / cScale, simHeight - (clientY - rect.top) / cScale)
		}

		const onTouchStart = (event: TouchEvent) => {
			for (const touch of Array.from(event.touches)) {
				const touchPos = getPointerPos(touch.clientX, touch.clientY)

				for (const flipper of physicsScene.flippers) {
					if (flipper.select(touchPos)) {
						flipper.touchIdentifier = touch.identifier
					}
				}
			}
		}

		const onTouchEnd = (event: TouchEvent) => {
			for (const flipper of physicsScene.flippers) {
				if (flipper.touchIdentifier < 0) {
					continue
				}

				const found = Array.from(event.touches).some(
					(touch) => touch.identifier === flipper.touchIdentifier
				)

				if (!found) {
					flipper.touchIdentifier = -1
				}
			}
		}

		const onMouseDown = (event: MouseEvent) => {
			const mousePos = getPointerPos(event.clientX, event.clientY)

			for (const flipper of physicsScene.flippers) {
				if (flipper.select(mousePos)) {
					flipper.touchIdentifier = 0
				}
			}
		}

		const onMouseUp = () => {
			for (const flipper of physicsScene.flippers) {
				flipper.touchIdentifier = -1
			}
		}

		const onKeydown = (event: KeyboardEvent) => {
			if (event.code === 'ArrowLeft') {
				physicsScene.flippers[0].touchIdentifier = 0
			}
			if (event.code === 'ArrowRight') {
				physicsScene.flippers[1].touchIdentifier = 0
			}
		}

		const onKeyup = (event: KeyboardEvent) => {
			if (event.code === 'ArrowLeft') {
				physicsScene.flippers[0].touchIdentifier = -1
			}
			if (event.code === 'ArrowRight') {
				physicsScene.flippers[1].touchIdentifier = -1
			}
		}

		restart = () => {
			setupScene()
			draw()
		}

		resizeCanvas()
		setupScene()
		draw()
		update()

		canvas.addEventListener('touchstart', onTouchStart, false)
		canvas.addEventListener('touchend', onTouchEnd, false)
		canvas.addEventListener('mousedown', onMouseDown, false)
		canvas.addEventListener('mouseup', onMouseUp, false)
		window.addEventListener('resize', resizeCanvas)
		window.addEventListener('keydown', onKeydown)
		window.addEventListener('keyup', onKeyup)

		return () => {
			cancelAnimationFrame(animationFrameId)
			canvas.removeEventListener('touchstart', onTouchStart, false)
			canvas.removeEventListener('touchend', onTouchEnd, false)
			canvas.removeEventListener('mousedown', onMouseDown, false)
			canvas.removeEventListener('mouseup', onMouseUp, false)
			window.removeEventListener('resize', resizeCanvas)
			window.removeEventListener('keydown', onKeydown)
			window.removeEventListener('keyup', onKeyup)
			restart = () => {}
		}
	})
</script>

<button class="btn btn-primary" onclick={restart}>Restart</button>
Score <span class="text-primary">{score}</span>
<br />

<div
	class="mockup-window border-base-300 relative mx-auto mt-5 h-[600px] w-full border bg-amber-400"
>
	<div class="h-full w-full bg-gray-50" bind:this={canvasContainerRef}>
		<canvas bind:this={canvasRef}></canvas>
	</div>
</div>
