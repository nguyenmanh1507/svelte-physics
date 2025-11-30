<script lang="ts">
	import { onMount } from 'svelte'
	import { CodeHighlight } from '$lib/components/code-highlight'
	import { Vector2 } from 'three'

	let canvasRef: HTMLCanvasElement | undefined

	let worldSize = $state(new Vector2(0, 0))
	let paused = $state(true)
	let balls = $state<Ball[]>([])

	class Ball {
		radius: number
		mass: number
		pos: Vector2
		vel: Vector2

		constructor(radius: number, mass: number, pos: Vector2, vel: Vector2) {
			this.radius = radius
			this.mass = mass
			this.pos = pos.clone()
			this.vel = vel.clone()
		}

		simulate(dt: number, gravity: Vector2) {
			this.vel.addScaledVector(gravity, dt)
			this.pos.addScaledVector(this.vel, dt)
		}
	}

	const physicsScene = $derived(() => ({
		gravity: new Vector2(0, 0),
		dt: 1 / 60,
		worldSize,
		paused,
		balls,
		restitution: 1,
	}))

	onMount(() => {
		if (!canvasRef) return

		const canvas = canvasRef

		canvas.width = canvas.clientWidth
		canvas.height = canvas.clientHeight

		let raf: number = 0
		const c = canvas.getContext('2d')
		const simMinWidth = 20
		const cScale = Math.min(canvas.width, canvas.height) / simMinWidth
		const simWidth = canvas.width / cScale
		const simHeight = canvas.height / cScale
		worldSize.set(simWidth, simHeight)

		function cX(pos: Vector2) {
			return pos.x * cScale
		}

		function cY(pos: Vector2) {
			return canvas.height - pos.y * cScale
		}

		function setupScene() {
			const numBalls = 20

			for (let i = 0; i < numBalls; i++) {
				const radius = 0.05 + Math.random() * 0.1 // Random radius between 0.05 and 0.15
				const mass = radius * radius * Math.PI // Density of 1
				const pos = new Vector2(Math.random() * simWidth, Math.random() * simHeight)
				const vel = new Vector2(-1 + 2 * Math.random(), -1 + 2 * Math.random())
				balls.push(new Ball(radius, mass, pos, vel))
			}
		}

		function draw() {
			if (!c) return

			c.clearRect(0, 0, canvas.width, canvas.height)
			c.fillStyle = '#FF0000'

			physicsScene().balls.forEach((ball) => {
				c.beginPath()
				c.arc(cX(ball.pos), cY(ball.pos), ball.radius * cScale, 0, 2 * Math.PI)
				c.closePath()
				c.fill()
			})
		}

		function handleBallCollision(ball1: Ball, ball2: Ball, restitution: number) {
			const dir = new Vector2()
			dir.subVectors(ball1.pos, ball2.pos)
			const d = dir.length()

			if (d === 0 || d > ball1.radius + ball2.radius) return

			dir.normalize()

			const corr = (ball1.radius + ball2.radius - d) / 2
			ball1.pos.addScaledVector(dir, -corr)
			ball2.pos.addScaledVector(dir, corr)

			const v1 = ball1.vel.dot(dir)
			const v2 = ball2.vel.dot(dir)

			const m1 = ball1.mass
			const m2 = ball2.mass

			const newV1 = (m1 * v1 + m2 * v2 - (v1 - v2) * restitution) / (m1 + m2)
			const newV2 = (m1 * v1 + m2 * v2 - (v2 - v1) * restitution) / (m1 + m2)

			ball1.vel.addScaledVector(dir, newV1 - v1)
			ball2.vel.addScaledVector(dir, newV2 - v2)
		}

		function handleWallCollision(ball: Ball, worldSize: Vector2) {
			if (ball.pos.x < ball.radius) {
				ball.pos.x = ball.radius
				ball.vel.x = -ball.vel.x
			}
			if (ball.pos.x > worldSize.x - ball.radius) {
				ball.pos.x = worldSize.x - ball.radius
				ball.vel.x = -ball.vel.x
			}
			if (ball.pos.y < ball.radius) {
				ball.pos.y = ball.radius
				ball.vel.y = -ball.vel.y
			}
			if (ball.pos.y > worldSize.y - ball.radius) {
				ball.pos.y = worldSize.y - ball.radius
				ball.vel.y = -ball.vel.y
			}
		}

		function simulate() {
			physicsScene().balls.forEach((ball) => {
				ball.simulate(physicsScene().dt, physicsScene().gravity)
				handleWallCollision(ball, physicsScene().worldSize)
				physicsScene().balls.forEach((otherBall) => {
					if (otherBall !== ball) {
						handleBallCollision(ball, otherBall, physicsScene().restitution)
					}
				})
			})
		}

		function update() {
			simulate()
			draw()
			raf = requestAnimationFrame(update)
		}

		setupScene()
		update()

		return () => {
			cancelAnimationFrame(raf)
		}
	})
</script>

<svelte:head>
	<title>03 - Ball collision handling in 2d</title>
</svelte:head>

<h1 class="mb-4 text-2xl font-bold">03 - Ball collision handling in 2d</h1>

<div class="grid grid-cols-2 gap-4">
	<canvas id="canvas" class="aspect-4/3 w-full rounded border" bind:this={canvasRef}></canvas>

	<CodeHighlight
		code={`
// Set canvas internal resolution to match its display size
// This ensures crisp rendering on high-DPI displays
canvas.width = canvas.clientWidth
canvas.height = canvas.clientHeight

// Animation frame ID for cleanup
let raf: number = 0
// Get 2D rendering context for drawing operations
const c = canvas.getContext('2d')
// Minimum simulation space width in simulation units
const simMinWidth = 20
// Calculate scale factor to convert simulation coordinates to canvas pixels
// Uses minimum dimension to ensure simulation fits within canvas
const cScale = Math.min(canvas.width, canvas.height) / simMinWidth
// Calculate simulation space dimensions in simulation units
const simWidth = canvas.width / cScale
const simHeight = canvas.height / cScale

// Type definition for 2D vector (position or velocity)
type Vec2 = { x: number; y: number }

// Convert simulation X coordinate to canvas X coordinate
function cX(pos: Vec2) {
	return pos.x * cScale
}

// Convert simulation Y coordinate to canvas Y coordinate
// Inverts Y-axis because canvas Y increases downward, but simulation Y increases upward
function cY(pos: Vec2) {
	return canvas.height - pos.y * cScale
}

// Physics constants
// Gravity vector: 0 horizontal, -10 vertical (downward in simulation space)
const gravity = { x: 0, y: -10 }
// Time step for physics simulation (60 FPS = 1/60 seconds per frame)
const timeStep = 1 / 60
// Ball object with properties in simulation units
const ball = {
	radius: 0.2, // Ball radius in simulation units
	pos: { x: 0.2, y: 0.2 }, // Initial position
	vel: { x: 10, y: 15 }, // Initial velocity (x: right, y: up)
}

// Render function: draws the current state of the simulation
function draw() {
	if (!c) return

	// Clear the entire canvas
	c.clearRect(0, 0, canvas.width, canvas.height)
	// Set fill color to red
	c.fillStyle = '#FF0000'
	// Begin drawing a circle path
	c.beginPath()
	// Draw circle: center at (cX, cY), radius scaled to canvas pixels, full circle
	c.arc(cX(ball.pos), cY(ball.pos), ball.radius * cScale, 0, 2 * Math.PI)
	c.closePath()
	// Fill the circle with the current fill style
	c.fill()
}

// Physics simulation function: updates ball position and velocity
function simulate() {
	// Apply gravity to velocity (acceleration = force/mass, assuming mass = 1)
	ball.vel.x += gravity.x * timeStep
	ball.vel.y += gravity.y * timeStep
	// Update position based on velocity (Euler integration)
	ball.pos.x += ball.vel.x * timeStep
	ball.pos.y += ball.vel.y * timeStep

	// Collision detection and response: left wall
	if (ball.pos.x < 0) {
		ball.pos.x = 0 // Clamp position to boundary
		ball.vel.x = -ball.vel.x // Reverse X velocity (perfect elastic collision)
	}

	// Collision detection and response: right wall
	if (ball.pos.x > simWidth) {
		ball.pos.x = simWidth // Clamp position to boundary
		ball.vel.x = -ball.vel.x // Reverse X velocity
	}

	// Collision detection and response: bottom wall (ground)
	if (ball.pos.y < 0) {
		ball.pos.y = 0 // Clamp position to boundary
		ball.vel.y = -ball.vel.y // Reverse Y velocity (bounce)
	}
}

// Main update loop: called every frame via requestAnimationFrame
function update() {
	draw() // Render the current frame
	simulate() // Update physics simulation
	requestAnimationFrame(update) // Schedule next frame
}

// Start the animation loop
update()
	`}
	/>
</div>
