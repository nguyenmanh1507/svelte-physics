# Volumetric Cloud Controls Design

## Goal

Give the volumetric-cloud demo a responsive, dark technical-inspector layout using the project's existing Tailwind CSS and DaisyUI setup.

## Layout

- Present the WebGL canvas and controls in a two-column grid on large screens.
- Keep the canvas as the dominant surface and constrain the inspector to approximately 22rem.
- Stack the canvas and inspector on narrower screens.
- Make the canvas wrapper responsive and square so the page does not overflow on mobile.

## Visual treatment

- Frame both surfaces with dark neutral backgrounds, subtle borders, and restrained shadows.
- Use cyan and emerald accents only for active, focus, and status states.
- Render the five shader steps as compact full-width buttons with a distinct active state.
- Group each visible slider into a labeled control row with a tabular-number value badge.
- Render reset as a full-width outlined secondary action.

## Accessibility and interaction

- Preserve native `button` and `input type="range"` semantics and keyboard behavior.
- Add visible focus rings to all interactive controls.
- Expose the selected shader step with `aria-pressed` in addition to its visual color.
- Associate each output value with its range input through the containing label.
- Avoid custom slider JavaScript; use native range controls with Tailwind `accent-*` styling.

## Verification

- Run the Svelte checker and project linting.
- Inspect the page in Chromium at desktop and mobile viewport widths.
- Confirm all steps, sliders, and reset controls remain usable and the console has no errors.
