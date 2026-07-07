# Tailwind v4 + Global Design Tokens for weather-app

**Date:** 2026-07-07
**Status:** Approved design, pending implementation plan
**Scope:** `apps/weather-app` only

## Goal

Add Tailwind CSS support to the `weather-app` React Router SPA and introduce a single,
easy-to-edit global file that declares default design tokens (colors and spacing). Colors
start as mock placeholder values that the owner will replace later, so the token structure
must make that swap a one-file change.

## Decisions

- **Tailwind v4 (CSS-first).** Uses the `@tailwindcss/vite` plugin and declares tokens
  directly in CSS via the `@theme` directive — no `tailwind.config.js` and no PostCSS config.
  This maps directly onto the ask for "a global file to declare default spacing and colors."
- **Semantic token layer.** A mock palette plus semantic aliases (`--color-primary`,
  `--color-surface`, `--color-text`, etc.) layered on top, so a later rebrand changes a few
  semantic values rather than every component.

## Architecture

### 1. Packages & build wiring

Add two dev dependencies to `apps/weather-app/package.json`:

- `tailwindcss` (v4)
- `@tailwindcss/vite` (official Vite plugin)

Wire `@tailwindcss/vite` into `apps/weather-app/vite.config.mts` alongside the existing
`reactRouter()` plugin.

Supply-chain note: both packages have been published well beyond the 2-week
`minimumReleaseAge: 20160` window, so **no `pnpm-workspace.yaml` exclusion is required**. If a
version resolves that is newer than 2 weeks, add it to `minimumReleaseAgeExclude` per the
existing project convention.

### 2. File structure

Two global CSS files under `apps/weather-app/app/styles/`, separating *tokens* from
*Tailwind setup* so the color swap is a single obvious file:

| File | Purpose |
|------|---------|
| `app/styles/theme.css` | **The file the owner edits.** Design tokens declared inside a Tailwind `@theme` block: mock brand palette + neutral scale, semantic color aliases, and layout spacing tokens. |
| `app/styles/app.css` | Entry stylesheet. `@import "tailwindcss";` then `@import "./theme.css";` plus any base resets. |

Wiring and cleanup:

- Import `app/styles/app.css` once in `apps/weather-app/app/root.tsx` via the `links` export
  as a `stylesheet` (the React Router idiom), added to the existing `links` array.
- Remove the currently-unused `apps/weather-app/styles.css` and `apps/weather-app/app/app.module.css`
  to avoid competing "global" stylesheets. (Both are effectively empty and unreferenced today.)

### 3. Token contents (mock values, easy to swap)

Declared inside `@theme` in `theme.css`:

- **Palette (mock, placeholder hues):**
  - `--color-brand-50` … `--color-brand-900`
  - `--color-neutral-50` … `--color-neutral-900`
- **Semantic aliases** (each references a palette value):
  - `--color-primary`, `--color-primary-hover`
  - `--color-surface`, `--color-surface-muted`
  - `--color-text`, `--color-text-muted`
  - `--color-border`
- **Spacing:** rely on Tailwind's default spacing scale, plus a small set of layout tokens for
  consistent gutters:
  - `--spacing-page`
  - `--spacing-section`

No per-activity (ski/surf/sightseeing) colors yet — YAGNI; they are easy to add later as
additional semantic tokens.

The semantic aliases generate Tailwind utilities such as `bg-primary`, `text-muted`,
`border-border`, `bg-surface`, which components should prefer over raw palette utilities.

### 4. Proof it works

Restyle the existing home view / `AppNav` (`apps/weather-app/app/app-nav.tsx`,
`apps/weather-app/app/app.tsx`) using a few semantic utilities (e.g. `bg-surface text-text`)
to demonstrate tokens render end-to-end.

## Testing

- `pnpm exec nx dev weather-app` — dev server starts and the restyled view renders with tokens applied.
- `pnpm exec nx build weather-app` — production build succeeds with Tailwind processing.
- `pnpm exec nx test-ci weather-app` — existing Vitest suite (`tests/routes/_index.spec.tsx`)
  stays green. The `@tailwindcss/vite` plugin must not break the Vitest run (tests execute in
  jsdom and do not require CSS to be applied).
- `pnpm exec nx lint weather-app` and `pnpm exec nx typecheck weather-app` — remain green.

## Out of scope

- Dark mode / theme switching.
- Extracting tokens into a shared `libs/` package (kept in-app; structure allows a later move).
- Per-activity color theming.
- Any component redesign beyond the minimal proof-of-render change.
