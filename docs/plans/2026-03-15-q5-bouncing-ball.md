# Q5 Bouncing Ball Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Mount a basic `q5.js` canvas inside the bouncing ball page's `mock-window` container.

**Architecture:** The page will expose a bound container div, initialize `q5` in `onMount`, and parent the generated canvas into that container. Cleanup will call `remove()` on the `q5` instance so navigation does not leak DOM nodes or animation loops.

**Tech Stack:** SvelteKit, Svelte 5, TypeScript, q5.js, Vitest browser

---

### Task 1: Add regression test

**Files:**
- Create: `src/routes/js-physics/bouncing-ball/page.svelte.spec.ts`
- Test: `src/routes/js-physics/bouncing-ball/page.svelte.spec.ts`

**Step 1: Write the failing test**

```ts
it('renders a q5 canvas inside the mock window', async () => {
	render(Page)

	const mockWindow = page.elementLocator('.mockup-window .bg-gray-50')

	await expect.element(mockWindow.locator('canvas')).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `corepack pnpm test:unit -- --run src/routes/js-physics/bouncing-ball/page.svelte.spec.ts`
Expected: FAIL because no canvas is created yet.

### Task 2: Implement q5 mount

**Files:**
- Modify: `src/routes/js-physics/bouncing-ball/+page.svelte`
- Test: `src/routes/js-physics/bouncing-ball/page.svelte.spec.ts`

**Step 1: Write minimal implementation**

- Bind the inner container div with `bind:this`.
- Create a `q5` instance in `onMount`.
- Call `createCanvas` with the container size.
- Draw a static frame.
- Call `remove()` during cleanup.

**Step 2: Run test to verify it passes**

Run: `corepack pnpm test:unit -- --run src/routes/js-physics/bouncing-ball/page.svelte.spec.ts`
Expected: PASS

### Task 3: Verify page integrity

**Files:**
- Modify: `src/routes/js-physics/bouncing-ball/+page.svelte`

**Step 1: Run project checks**

Run: `corepack pnpm check`
Expected: PASS for the touched page.
