<script lang="ts">
	import './layout.css'
	import favicon from '$lib/assets/favicon.svg'
	import { resolve } from '$app/paths'

	let { children } = $props()
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Svelte Physics</title>
</svelte:head>

<div class="navbar bg-neutral text-neutral-content shadow-sm">
	<div class="flex-1">
		<a href={resolve('/')} class="btn btn-ghost text-xl">Svelte Physics</a>
	</div>
	<div class="flex-none">
		<ul class="menu menu-horizontal px-1">
			<li><a href={resolve('/')} class="link">Home</a></li>
			<li><a href={resolve('/threlte')} class="link" data-sveltekit-preload-data>Threlte</a></li>
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
<main class="container mx-auto px-4 py-4 md:px-0">
	{@render children()}
</main>
