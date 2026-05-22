# Design Guidelines

_Last updated: 2026-05-22_

## Visual Direction

9Router uses a warm operational dashboard style: coral brand accents, soft light neutrals, restrained dark mode, and utility-first layouts. The interface should feel practical and dense enough for power users without becoming visually noisy.

## Theme Foundations

- Brand accent: coral/orange centered on `#E56A4A`
- Light surfaces: warm off-white and soft neutral backgrounds
- Dark surfaces: charcoal neutrals with the same coral accent
- Theme tokens live in `src/app/globals.css`
- `--color-primary` remains a compatibility alias for existing components

## Typography and Icons

- Primary font: Inter via `next/font/google`
- Icons: Material Symbols Outlined
- Use clear operational labels over decorative copy

## Layout Patterns

- The app has two main shells: landing and dashboard
- Dashboard UI should optimize for scanning, status reading, and fast configuration changes
- Prefer cards, drawers, and modals already present in `src/shared/components/*`
- Long forms should group related settings and keep destructive actions obvious

## Component Guidance

- Reuse shared primitives such as `Card`, `Button`, `Modal`, `Drawer`, `Badge`, `Tooltip`, and layout wrappers
- Keep provider-specific visuals consistent with existing provider cards and icon patterns
- Surface risk notices clearly for deprecated or high-risk providers

## Color and Feedback

- Success, warning, info, and danger colors already exist as semantic tokens
- Use color as reinforcement, not the only status signal
- Important states should also include text labels, badges, or icons

## Motion and Interaction

- Keep motion subtle and fast
- Avoid ornamental animation in operational screens
- Preserve responsive behavior on desktop-first pages and ensure mobile layouts remain usable

## Internationalization

- Runtime locale support exists for a broad language set under `public/i18n/literals/*`
- New user-facing strings should be written so they can be localized cleanly
- Avoid hard-coded text inside deeply reused components when a shared literal path exists

## Copy Style

- Prefer direct operational language
- Keep warnings explicit
- Avoid marketing claims inside settings and admin workflows
