# Repository Guidelines

## Project Structure & Module Organization

- `src/routes` contains SvelteKit routes and page components (e.g., `src/routes/+page.svelte`).
- `src/lib` holds reusable components, utilities, and shared modules.
- `src/stories` is Storybook content and assets for UI examples.
- `e2e` contains Playwright end-to-end tests.
- `static` holds public assets served as-is.

## Build, Test, and Development Commands

- `pnpm dev`: run the Vite dev server for local development.
- `pnpm build`: build the production bundle.
- `pnpm preview`: serve the production build locally.
- `pnpm lint`: run Prettier check and ESLint.
- `pnpm format`: auto-format with Prettier.
- `pnpm test:unit`: run Vitest unit tests.
- `pnpm test:e2e`: run Playwright end-to-end tests.
- `pnpm test`: run unit tests once, then e2e tests.
- `pnpm storybook`: run Storybook at `http://localhost:6006`.

## Coding Style & Naming Conventions

- Use 2-space indentation (Svelte, TypeScript, config files).
- Prefer `.svelte` for components and `.ts` for modules/utilities.
- Use kebab-case for routes and filenames where SvelteKit conventions apply (e.g., `+page.svelte`, `+layout.svelte`).
- Formatting and linting are enforced by Prettier and ESLint (`eslint.config.js`).

## Testing Guidelines

- Unit tests use Vitest and live near source (`src/**/*.spec.ts`).
- End-to-end tests use Playwright in `e2e/*.test.ts`.
- Prefer descriptive test names that reflect user behavior or feature intent.

## Commit & Pull Request Guidelines

- Commit messages follow a conventional prefix style seen in history: `feat: ...`, `fix: ...`.
- PRs should include a short description, testing notes, and screenshots for UI changes.
- Link related issues or discussions when applicable.

## Environment & Configuration Tips

- Node.js `>=24` is required (see `package.json` engines).
- Run `pnpm install` after pulling dependency changes.
