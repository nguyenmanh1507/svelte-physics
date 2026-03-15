import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'

import Page from './+page.svelte'

describe('/js-physics/bouncing-ball/+page.svelte', () => {
	it('renders a q5 canvas inside the mock window', async () => {
		const view = await render(Page)

		expect(view.container.querySelector('.mockup-window .bg-gray-50 canvas')).not.toBeNull()
	})
})
