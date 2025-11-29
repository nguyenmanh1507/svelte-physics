<script lang="ts">
	import './layout.css'
	import favicon from '$lib/assets/favicon.svg'
	import PageHeader from '$lib/components/page-header.svelte'

	let { children } = $props()
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Svelte Physics</title>
</svelte:head>

<PageHeader />
<main class="container mx-auto px-4 py-4 md:px-0">
	{@render children()}
</main>
