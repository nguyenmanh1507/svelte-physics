<script lang="ts">
	import { onMount } from 'svelte'
	import { CodeHighlight } from '~/lib/components/code-highlight'

	let canvasRef: HTMLCanvasElement | undefined

	onMount(() => {
		// Early return if canvas reference is not available
		if (!canvasRef) return

		const canvas = canvasRef

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
		// const simHeight = canvas.height / cScale

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
			raf = requestAnimationFrame(update) // Schedule next frame
		}

		// Start the animation loop
		update()

		return () => {
			cancelAnimationFrame(raf)
		}
	})
</script>

<svelte:head>
	<title>01 - Introduction to 2d web browser physics</title>
</svelte:head>

<h1 class="mb-4 text-2xl font-bold">01 - Introduction to 2d web browser physics</h1>

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
