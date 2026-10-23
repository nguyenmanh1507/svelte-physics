import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
import { sveltekit } from '@sveltejs/kit/vite'
import { createLogger } from 'vite'
import adapter from '@sveltejs/adapter-static'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

const logger = createLogger()
const warn = logger.warn

logger.warn = (message, options) => {
	const isJoltNodeModuleWarning =
		message.includes('Module "node:module" has been externalized for browser compatibility') &&
		message.includes('jolt-physics') &&
		message.includes('jolt-physics.wasm-compat.js')

	if (!isJoltNodeModuleWarning) warn(message, options)
}

export default defineConfig({
	customLogger: logger,
	plugins: [
		tailwindcss(),
		sveltekit({
			preprocess: vitePreprocess(),
			adapter: adapter({
				pages: 'build',
				assets: 'build',
				fallback: undefined,
				precompress: false,
				strict: true,
			}),
		}),
	],
	build: {
		rolldownOptions: {
			onLog(level, log, handler) {
				const isThrelteUnusedImport =
					level === 'warn' &&
					log.code === 'UNUSED_EXTERNAL_IMPORT' &&
					log.ids?.length &&
					log.ids.every((id) => /[/\\]node_modules[/\\]@threlte[/\\]/.test(id))

				if (!isThrelteUnusedImport) handler(level, log)
			},
		},
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }],
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**'],
				},
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}'],
				},
			},
		],
	},
})
