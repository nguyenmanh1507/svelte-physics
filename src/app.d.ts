// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type JoltType from 'jolt-physics'

declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	interface Window {
		Jolt?: typeof JoltType
	}

	// Global Jolt variable (available like addEventListener)
	var Jolt: typeof JoltType | undefined
}

export {}
