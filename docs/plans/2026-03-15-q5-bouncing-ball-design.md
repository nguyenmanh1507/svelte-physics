# Q5 Bouncing Ball Design

**Goal:** Mount a basic `q5.js` canvas inside the `mock-window` container on the bouncing ball page without adding simulation behavior yet.

**Context:** The page already imports `q5` and renders a `mockup-window`, but it does not provide a mount target or create a sketch instance.

## Design

- Bind the inner `mock-window` content div to an `HTMLDivElement` reference.
- Create a minimal `q5` instance in `onMount` using instance mode.
- Size the canvas from the container and append it inside the bound div.
- Draw a static placeholder frame so the mounted canvas is visible.
- Remove the `q5` instance on unmount to avoid leaving orphaned canvases behind during route changes.

## Testing

- Add a browser unit test for the page.
- Render the page component and verify a `canvas` element appears inside the `mock-window`.
