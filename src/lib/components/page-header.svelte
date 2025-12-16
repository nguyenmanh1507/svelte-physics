<script lang="ts">
	import { resolve } from '$app/paths'
	import { page } from '$app/state'

	import { cn } from '$lib/utils/tailwind'

	// Menu item types
	type MenuLink = {
		label: string
		href: string
		preloadData?: boolean
	}

	type MenuDropdown = {
		label: string
		children: MenuLink[]
	}

	type MenuItem = MenuLink | MenuDropdown

	function isMenuDropdown(item: MenuItem): item is MenuDropdown {
		return 'children' in item
	}

	// Menu configuration
	const menuItems: MenuItem[] = [
		{
			label: 'Home',
			href: '/',
		},
		{
			label: 'Threlte',
			children: [
				{
					label: 'Introduction',
					href: '/threlte/introduction',
					preloadData: true,
				},
			],
		},
		{
			label: 'Ten Minute Physics',
			children: [
				{
					label: '01 - Introduction to 2d web browser physics',
					href: '/ten-min-physics/01-intro-2D-physics',
				},
				{
					label: '02 - Cannon 3D',
					href: '/ten-min-physics/02-cannon-3D',
				},
				{
					label: '03 - Billiards',
					href: '/ten-min-physics/03-billiard',
				},
			],
		},
		{
			label: 'Games',
			children: [
				{
					label: 'Match 3',
					href: '/games/match-3',
				},
			],
		},
	]

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

	// Helper to resolve paths with type assertion for dynamic routes
	function resolvePath(path: string): string {
		return resolve(path as any)
	}
</script>

<div class="navbar bg-neutral text-neutral-content shadow-sm">
	<div class="flex-1">
		<a href={resolve('/')} class="btn btn-ghost text-xl">Svelte Physics</a>
	</div>
	<div class="flex-none">
		<ul class="menu menu-horizontal px-1">
			{#each menuItems as item}
				<li>
					{#if isMenuDropdown(item)}
						<details>
							<summary>{item.label}</summary>
							<ul class="bg-neutral rounded-t-none p-2">
								{#each item.children as child}
									<li>
										<a href={resolvePath(child.href)} class={activeClass(child.href)}>
											{child.label}
										</a>
									</li>
								{/each}
							</ul>
						</details>
					{:else}
						<a
							href={resolvePath(item.href)}
							class={activeClass(item.href)}
							data-sveltekit-preload-data={item.preloadData || undefined}
						>
							{item.label}
						</a>
					{/if}
				</li>
			{/each}
		</ul>
	</div>
</div>
