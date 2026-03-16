<script lang="ts">
	import { resolve } from '$app/paths'
	import { page } from '$app/state'
	import { cn } from '$lib/utils/tailwind'
	import * as NavigationMenu from '$lib/components/ui/navigation-menu/index.js'
	import type { HTMLAttributes } from 'svelte/elements'

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
				{
					label: 'Postprocessing',
					href: '/threlte/postprocessing',
					preloadData: true,
				},
				{
					label: 'Gemstone',
					href: '/threlte/gemstone',
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
				{
					label: '04 - Pinball Simulation',
					href: '/ten-min-physics/04-pinball-simulation',
				},
			],
		},
		{
			label: 'Jolt Physics',
			children: [
				{
					label: 'Simple',
					href: '/jolt-physics/simple',
				},
				{
					label: 'Example',
					href: '/jolt-physics/example',
				},
				{
					label: 'Integrate to Threlte',
					href: '/jolt-physics/integrate-to-threlte',
				},
				{
					label: 'Arcade Plane Controller',
					href: '/jolt-physics/arcade-plane-controller',
				},
				{
					label: 'Arcade Car Controller',
					href: '/jolt-physics/arcade-car-controller',
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
				{
					label: 'LittleJS: Breakout',
					href: '/games/littlejs-breakout',
				},
				{
					label: 'State Pattern - ChatGPT',
					href: '/games/state-pattern-chatgpt',
				},
			],
		},
		{
			label: 'JS Physics',
			children: [
				{
					label: 'Bouncing Ball',
					href: '/js-physics/bouncing-ball',
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

	const resolveHref = resolve as (path: string) => string

	type ListItemProps = HTMLAttributes<HTMLAnchorElement> & {
		title: string
		href: string
	}
</script>

{#snippet ListItem({ title, href, class: className, ...restProps }: ListItemProps)}
	<li>
		<NavigationMenu.Link class="p-0">
			<a
				href={resolve(href as any)}
				class={cn(
					'hover:bg-neutral focus:bg-neutral block space-y-1 p-3 leading-none no-underline transition-colors outline-none select-none hover:text-white focus:text-white',
					className
				)}
				{...restProps}
			>
				<div class="text-sm leading-none font-medium">{title}</div>
			</a>
		</NavigationMenu.Link>
	</li>
{/snippet}

<div class="navbar bg-neutral text-neutral-content z-10 flex justify-center shadow-sm">
	<NavigationMenu.Root viewport={false}>
		<NavigationMenu.List class="flex-wrap">
			{#each menuItems as item (item.label)}
				<NavigationMenu.Item
					openOnHover={false}
					class={!isMenuDropdown(item) ? activeClass(item.href) : ''}
				>
					{#if isMenuDropdown(item)}
						<NavigationMenu.Trigger class="bg-transparent">{item.label}</NavigationMenu.Trigger>
					{:else}
						<NavigationMenu.Link href={resolveHref(item.href)}>
							{item.label}
						</NavigationMenu.Link>
					{/if}

					{#if isMenuDropdown(item)}
						<NavigationMenu.Content class="p-0">
							<ul class="min-w-[200px]">
								{#each item.children as child, i (i)}
									{@render ListItem({
										href: child.href,
										title: child.label,
									})}
								{/each}
							</ul>
						</NavigationMenu.Content>
					{/if}
				</NavigationMenu.Item>
			{/each}
		</NavigationMenu.List>
	</NavigationMenu.Root>
</div>
