<script lang="ts">
	import { resolve } from '$app/paths'
	import { page } from '$app/state'

	import { cn } from '$lib/utils/tailwind'

	// Helper function to check if a path is active
	function isActive(path: string): boolean {
		const current = page.url.pathname
		// Normalize paths by removing trailing slashes (except root)
		const normalizedPath = path === '/' ? '/' : path.replace(/\/$/, '')
		const normalizedCurrent = current === '/' ? '/' : current.replace(/\/$/, '')
		return normalizedCurrent === normalizedPath
	}

	function activeClass(path: string): string {
		return cn('link font-bold', isActive(path) && 'text-green-300')
	}
</script>

<div class="navbar bg-neutral text-neutral-content shadow-sm">
	<div class="flex-1">
		<a href={resolve('/')} class="btn btn-ghost text-xl">Svelte Physics</a>
	</div>
	<div class="flex-none">
		<ul class="menu menu-horizontal px-1">
			<li>
				<a href={resolve('/')} class={activeClass('/')}> Home </a>
			</li>
			<li>
				<a href={resolve('/threlte')} class={activeClass('/threlte')} data-sveltekit-preload-data>
					Threlte
				</a>
			</li>
			<li>
				<details>
					<summary>Ten Minute Physics</summary>
					<ul class="bg-neutral rounded-t-none p-2">
						<li>
							<a
								href={resolve('/ten-min-physics/01-intro-2D-physics')}
								class={activeClass('/ten-min-physics/01-intro-2D-physics')}
							>
								01 - Introduction to 2d web browser physics
							</a>
						</li>
						<li>
							<a
								href={resolve('/ten-min-physics/02-cannon-3D')}
								class={activeClass('/ten-min-physics/02-cannon-3D')}
							>
								02 - Cannon 3D
							</a>
						</li>
						<li>
							<a
								href={resolve('/ten-min-physics/03-billiard')}
								class={activeClass('/ten-min-physics/03-billiard')}
							>
								03 - Billiards
							</a>
						</li>
					</ul>
				</details>
			</li>
		</ul>
	</div>
</div>
