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
				<a href={resolve('/ten-min-physics')} class={activeClass('/ten-min-physics')}>
					Ten Minute Physics
				</a>
			</li>
			<!-- <li>
				<details>
					<summary>About</summary>
					<ul class="bg-neutral rounded-t-none p-2">
						<li><a href="/about" class="link">About</a></li>
						<li><a href="/contact" class="link">Contact</a></li>
					</ul>
				</details>
			</li> -->
		</ul>
	</div>
</div>
