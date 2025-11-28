<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="navbar bg-neutral shadow-sm text-neutral-content">
  <div class="flex-1">
    <a href="/" class="btn btn-ghost text-xl">daisyUI</a>
  </div>
  <div class="flex-none">
    <ul class="menu menu-horizontal px-1">
      <li><a href="/">Home</a></li>
      <li>
        <details>
          <summary>About</summary>
          <ul class="bg-neutral rounded-t-none p-2">
            <li><a href="/about">About</a></li>
            <li><a href="/contact">Contact</a></li>
          </ul>
        </details>
      </li>
    </ul>
  </div>
</div>
<main class="container mx-auto py-4 px-4 md:px-0">
  {@render children()}
</main>
