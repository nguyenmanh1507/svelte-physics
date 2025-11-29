<script lang="ts">
	import Prism from 'prismjs'
	import 'prismjs/themes/prism.css'
	import 'prismjs/components/prism-typescript'
	import { onMount } from 'svelte'

	onMount(() => {
		Prism.highlightAll()
	})

	let { code, language = 'ts' } = $props()
</script>

<pre class="mt-0!"><code class="language-{language}">{code}</code></pre>
