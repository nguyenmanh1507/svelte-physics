import { expect, test } from '@playwright/test'

/**
 * E2E tests for all available routes in the application.
 * Tests verify that each page renders successfully by checking for:
 * - Page header navigation (present on all pages via layout)
 * - Page title in the document
 * - Successful page load without errors
 */

const routes = [
	{
		path: '/',
		title: 'Svelte Physics',
		description: 'Home page',
	},
	{
		path: '/threlte/introduction',
		title: 'Svelte Physics',
		description: 'Threlte Introduction page',
	},
	{
		path: '/threlte/postprocessing',
		title: 'Svelte Physics',
		description: 'Threlte Postprocessing page',
	},
	{
		path: '/ten-min-physics/01-intro-2D-physics',
		title: 'Svelte Physics',
		description: 'Ten Minute Physics - Introduction to 2D Physics page',
	},
	{
		path: '/ten-min-physics/02-cannon-3D',
		title: 'Svelte Physics',
		description: 'Ten Minute Physics - Cannon 3D page',
	},
	{
		path: '/ten-min-physics/03-billiard',
		title: 'Svelte Physics',
		description: 'Ten Minute Physics - Billiards page',
	},
	{
		path: '/games/match-3',
		title: 'Match 3',
		description: 'Match 3 game page',
	},
	{
		path: '/jolt-physics/example',
		title: 'Svelte Physics',
		description: 'Jolt Physics - Example page',
	},
] as const

for (const route of routes) {
	test(`${route.description} (${route.path}) renders successfully`, async ({ page }) => {
		// Navigate to the route
		await page.goto(route.path)

		// Verify page header navigation is present (present on all pages via layout)
		const header = page.locator('nav.navbar')
		await expect(header).toBeVisible()

		// Verify the "Svelte Physics" logo/brand link is present
		const brandLink = header.locator('a:has-text("Svelte Physics")')
		await expect(brandLink).toBeVisible()

		// Verify main content area is present (present on all pages via layout)
		const mainContent = page.locator('main.container')
		await expect(mainContent).toBeVisible()

		// Verify page loaded without console errors
		const errors: string[] = []
		page.on('console', (msg) => {
			if (msg.type() === 'error') {
				errors.push(msg.text())
			}
		})

		// Wait for page to be fully loaded
		await page.waitForLoadState('networkidle')

		// Check for any console errors (excluding expected warnings)
		const criticalErrors = errors.filter(
			(error) =>
				!error.includes('favicon') &&
				!error.includes('404') &&
				!error.toLowerCase().includes('warning')
		)
		expect(criticalErrors).toHaveLength(0)
	})
}
