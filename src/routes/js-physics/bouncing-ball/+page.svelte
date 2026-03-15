<script lang="ts">
	import p5 from 'p5'
	import { onMount } from 'svelte'

	let canvasHost: HTMLDivElement | undefined

	onMount(() => {
		if (!canvasHost) return

		const host = canvasHost

		const radius = 20
		const ballColor = '#4C8CE4'
		// Physics variables
		const g = 0.1 // gravity
		let x = 50 // initial x position
		let y = 50 // initial y position
		let vx = 2 // initial x velocity
		let vy = 0 // initial y velocity

		function setup(q: p5) {
			const width = host.clientWidth || 640
			const height = host.clientHeight || 360
			q.createCanvas(width, height)
			q.background('#91D06C')
			q.noStroke()
			q.fill(ballColor)
			q.circle(x, y, radius * 2)
		}

		function draw(q: p5) {
			console.log({
				x,
				y,
				vx,
				vy,
				radius,
				width: q.width,
				height: q.height,
			})
			vy += g // gravity increase vertical velocity speed
			x += vx // horizontal speed increases horizontal position
			y += vy // vertical speed increases vertical position

			// if ball hit ground, reverse vertical velocity
			if (y + radius > q.height) {
				y = q.height - radius
				vy *= -0.8 // bounce with 80% of original velocity
			}
			// if ball hit left or right wall, reverse horizontal velocity
			if (x - radius < 0 || x + radius > q.width) {
				x = x < 0 ? radius : q.width - radius
				vx *= -0.8 // bounce with 80% of original velocity
			}

			q.background('#91D06C')
			q.noStroke()
			q.fill(ballColor)
			q.circle(x, y, radius)
		}

		const sketch = new p5((q: p5) => {
			q.setup = () => setup(q)
			q.draw = () => draw(q)
		}, host)

		return () => {
			sketch.remove()
		}
	})
</script>

<div class="mockup-window border-base-300 relative w-full border bg-amber-400">
	<div class="aspect-video w-full bg-gray-50" bind:this={canvasHost}></div>
</div>
