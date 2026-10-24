# Volumetric Cloud Controls Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Style the volumetric-cloud canvas and controls as a responsive dark technical inspector.

**Architecture:** Keep state and control rendering in the route, using Tailwind utilities for layout, hierarchy, and interaction states. Make the existing canvas host responsive so it can fill the available stage without overflowing narrow viewports.

**Tech Stack:** Svelte 5, Tailwind CSS 4, DaisyUI, Three.js, Playwright

---

### Task 1: Style the page and controls

**Files:**

- Modify: `src/routes/games/volumetric-cloud/+page.svelte:50-70`

**Step 1: Add semantic control state**

Add `aria-pressed={step === i + 1}` to each step button so the active state is available without relying on color.

**Step 2: Add the responsive inspector layout**

Replace the plain flex container with a responsive grid that stacks by default and uses a flexible canvas column plus a 22rem inspector column at large breakpoints.

**Step 3: Style step navigation**

Use full-width dark buttons, visible focus rings, muted inactive text, and a cyan active border/background treatment.

**Step 4: Style sliders and values**

Use compact label rows, full-width native range inputs with `accent-cyan-400`, and tabular-number output badges. Keep native slider keyboard and pointer behavior.

**Step 5: Style the reset action**

Use a full-width outlined button with hover and focus-visible states.

### Task 2: Make the canvas host responsive

**Files:**

- Modify: `src/routes/games/volumetric-cloud/components/volumetric-cloud.svelte:114-116`

**Step 1: Replace fixed dimensions**

Change the fixed `h-150 w-150` wrapper to `aspect-square`, `w-full`, and an appropriate maximum width so it responds to its grid column and mobile viewport.

**Step 2: Preserve canvas fill behavior**

Give the canvas `h-full w-full` while preserving block layout so the existing `ResizeObserver` sizes the renderer correctly.

### Task 3: Verify behavior and presentation

**Files:**

- Verify: `src/routes/games/volumetric-cloud/+page.svelte`
- Verify: `src/routes/games/volumetric-cloud/components/volumetric-cloud.svelte`

**Step 1: Format the changed files**

Run: `pnpm exec prettier --write src/routes/games/volumetric-cloud/+page.svelte src/routes/games/volumetric-cloud/components/volumetric-cloud.svelte`

Expected: Both files format successfully.

**Step 2: Run static checks**

Run: `pnpm check`

Expected: Zero Svelte errors and warnings.

Run: `pnpm lint`

Expected: Prettier and ESLint pass.

**Step 3: Verify in Chromium**

Open `/games/volumetric-cloud` at desktop and mobile viewport widths. Confirm the canvas is contained, the inspector stacks on mobile, active step and focus states are visible, sliders update their values, reset works, and the browser console is clean.
