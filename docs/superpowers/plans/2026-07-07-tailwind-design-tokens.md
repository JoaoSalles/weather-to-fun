# Tailwind v4 + Global Design Tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Tailwind CSS v4 to the `weather-app` SPA with a single, easy-to-edit global CSS file that declares semantic color and spacing design tokens (mock values, swappable later).

**Architecture:** Tailwind v4 CSS-first. The `@tailwindcss/vite` plugin compiles utilities; tokens are declared in a dedicated `theme.css` via the `@theme` directive and layered as semantic aliases over a mock palette. An `app.css` entry imports Tailwind then the tokens, and is loaded once through React Router's `links` export in `root.tsx`.

**Tech Stack:** Tailwind CSS v4 (`tailwindcss`, `@tailwindcss/vite`), Vite 8, React Router 7 (SPA), Vitest 4 (jsdom), Nx 23, pnpm.

## Global Constraints

- **Scope:** `apps/weather-app` only. No shared `libs/` extraction.
- **Package manager:** pnpm via Nx. Dependencies go in `apps/weather-app/package.json`.
- **Supply-chain guardrail:** `pnpm-workspace.yaml` sets `minimumReleaseAge: 20160` (2 weeks). Use `^4.3.1` for both Tailwind packages — pnpm auto-selects the newest version older than the threshold. Do **not** add a `minimumReleaseAgeExclude` entry unless install fails on the guardrail.
- **Vitest gating:** In `vite.config.mts`, plugins are gated with `!process.env.VITEST` (see existing `reactRouter()`). Gate `tailwindcss()` the same way for consistency and test safety.
- **Test command:** Use `pnpm exec nx test weather-app` (runs once; `watch: false` in the Vite test config). Do **not** use `test-ci` — it requires Nx Cloud and errors locally.
- **Semantic-first:** Components use semantic utilities (`bg-primary`, `text-text`, `bg-surface`, `text-text-muted`), not raw palette utilities (`bg-brand-500`).
- **Tailwind v4 utility naming:** A token `--color-<name>` produces utilities using `<name>` after the property prefix. So `--color-text` → `text-text`, `--color-text-muted` → `text-text-muted`, `--color-surface-muted` → `bg-surface-muted`. The doubled `text-text` reads oddly but is correct — do not shorten it to `text-muted`.

---

### Task 1: Install Tailwind v4 and wire the Vite plugin

**Files:**
- Modify: `apps/weather-app/package.json` (add devDependencies)
- Modify: `apps/weather-app/vite.config.mts` (add plugin)
- Create: `apps/weather-app/app/styles/app.css`
- Modify: `apps/weather-app/app/root.tsx` (import stylesheet via `links`)

**Interfaces:**
- Produces: a compiled Tailwind stylesheet served by the app. `app/styles/app.css` is the entry stylesheet (currently `@import "tailwindcss";` only; Task 2 adds the tokens import). `root.tsx` `links` includes `{ rel: "stylesheet", href: appCssHref }` where `appCssHref` is the Vite-resolved URL from `import appCss from "./styles/app.css?url"`.

- [ ] **Step 1: Add Tailwind dependencies**

Run:
```bash
pnpm --filter @collinson/weather-app add -D tailwindcss@^4.3.1 @tailwindcss/vite@^4.3.1
```
Expected: install succeeds; `apps/weather-app/package.json` `devDependencies` now lists `tailwindcss` and `@tailwindcss/vite` at `^4.3.1`. If pnpm refuses on `minimumReleaseAge`, re-run — pnpm should select `4.3.1`; only then add the exact blocked version to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml`.

- [ ] **Step 2: Wire the plugin into Vite (gated for Vitest)**

In `apps/weather-app/vite.config.mts`, add the import and the plugin. Replace the import block top:
```ts
/// <reference types='vitest' />
import { defineConfig } from 'vite';
import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
```
And change the `plugins` line to:
```ts
  plugins: [!process.env.VITEST && reactRouter(), !process.env.VITEST && tailwindcss()],
```

- [ ] **Step 3: Create the entry stylesheet**

Create `apps/weather-app/app/styles/app.css`:
```css
/* Tailwind v4 entry stylesheet. Token declarations live in ./theme.css (added in Task 2). */
@import "tailwindcss";
```

- [ ] **Step 4: Load the stylesheet in root.tsx**

In `apps/weather-app/app/root.tsx`, add this import near the top (after the react-router imports):
```ts
import appCss from "./styles/app.css?url";
```
Then add the stylesheet to the existing `links` array as the first entry:
```ts
export const links: LinksFunction = () => [
  { rel: "stylesheet", href: appCss },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];
```

- [ ] **Step 5: Verify the production build compiles Tailwind**

Run:
```bash
pnpm exec nx build weather-app
```
Expected: build succeeds. Then confirm Tailwind's reset compiled into the output:
```bash
grep -rl "box-sizing" apps/weather-app/dist/**/*.css | head -1
```
Expected: prints at least one built CSS file path (Tailwind Preflight emits `box-sizing:border-box`).

- [ ] **Step 6: Verify typecheck, lint, and existing tests still run**

Run:
```bash
pnpm exec nx typecheck weather-app && pnpm exec nx lint weather-app
```
Expected: both pass. (The `_index.spec.tsx` test is still expected to FAIL at this point — it is fixed in Task 2. Do not run `test` as a gate here.)

- [ ] **Step 7: Commit**

```bash
git add apps/weather-app/package.json apps/weather-app/vite.config.mts apps/weather-app/app/styles/app.css apps/weather-app/app/root.tsx pnpm-lock.yaml
git commit -m "feat(weather-app): add Tailwind v4 and wire Vite plugin"
```

---

### Task 2: Add semantic design tokens and prove they render

**Files:**
- Create: `apps/weather-app/app/styles/theme.css`
- Modify: `apps/weather-app/app/styles/app.css` (import tokens)
- Modify: `apps/weather-app/app/app.tsx` (restyle + render expected text)
- Modify: `apps/weather-app/app/app-nav.tsx` (restyle with semantic utilities)
- Delete: `apps/weather-app/styles.css`, `apps/weather-app/app/app.module.css`
- Test: `apps/weather-app/tests/routes/_index.spec.tsx` (existing — becomes the TDD anchor)

**Interfaces:**
- Consumes: `app/styles/app.css` and the wired Tailwind plugin from Task 1.
- Produces: semantic utility classes usable app-wide — `bg-primary`, `hover:bg-primary-hover`, `bg-surface`, `bg-surface-muted`, `text-text`, `text-text-muted`, `hover:text-primary`, `border-border` — backed by CSS custom properties (`--color-primary`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-border`, `--color-primary-hover`) and spacing tokens `p-page` / `gap-page` / `p-section` (from `--spacing-page`, `--spacing-section`).

- [ ] **Step 1: Confirm the existing render test currently fails**

Run:
```bash
pnpm exec nx test weather-app
```
Expected: FAIL — `_index.spec.tsx` times out on `screen.findByText('Hello there,')` because `app.tsx` renders `home`. This is the red state we will fix.

- [ ] **Step 2: Create the token file**

Create `apps/weather-app/app/styles/theme.css`. Values are MOCK placeholders — safe to replace later:
```css
/*
 * Design tokens for weather-app (Tailwind v4 @theme).
 * MOCK colors — replace the palette and/or semantic aliases below; utilities update automatically.
 * Prefer semantic utilities (bg-primary, text-muted) over raw palette utilities in components.
 */
@theme {
  /* --- Mock brand palette --- */
  --color-brand-50: #eef4ff;
  --color-brand-100: #d9e6ff;
  --color-brand-200: #b3cdff;
  --color-brand-300: #85acff;
  --color-brand-400: #5685f7;
  --color-brand-500: #2f63e6;
  --color-brand-600: #1f4bc2;
  --color-brand-700: #1a3c99;
  --color-brand-800: #172f73;
  --color-brand-900: #12234f;

  /* --- Neutral scale --- */
  --color-neutral-50: #f8fafc;
  --color-neutral-100: #f1f5f9;
  --color-neutral-200: #e2e8f0;
  --color-neutral-300: #cbd5e1;
  --color-neutral-400: #94a3b8;
  --color-neutral-500: #64748b;
  --color-neutral-600: #475569;
  --color-neutral-700: #334155;
  --color-neutral-800: #1e293b;
  --color-neutral-900: #0f172a;

  /* --- Semantic aliases (change these to rebrand) --- */
  --color-primary: var(--color-brand-500);
  --color-primary-hover: var(--color-brand-600);
  --color-surface: var(--color-neutral-50);
  --color-surface-muted: var(--color-neutral-100);
  --color-text: var(--color-neutral-900);
  --color-text-muted: var(--color-neutral-500);
  --color-border: var(--color-neutral-200);

  /* --- Layout spacing tokens --- */
  --spacing-page: 1.5rem;
  --spacing-section: 3rem;
}
```

- [ ] **Step 3: Import tokens from the entry stylesheet**

Update `apps/weather-app/app/styles/app.css` to:
```css
/* Tailwind v4 entry stylesheet. */
@import "tailwindcss";
@import "./theme.css";
```

- [ ] **Step 4: Restyle app.tsx and render the text the test expects**

Replace the contents of `apps/weather-app/app/app.tsx` with:
```tsx
export function App() {
  return (
    <main className="bg-surface text-text p-page">
      <h1 className="text-text">Hello there,</h1>
      <p className="text-text-muted">Weather-driven activity rankings, coming soon.</p>
    </main>
  );
}

export default App;
```

- [ ] **Step 5: Verify the render test now passes**

Run:
```bash
pnpm exec nx test weather-app
```
Expected: PASS — `_index.spec.tsx` finds `Hello there,`.

- [ ] **Step 6: Restyle AppNav with semantic utilities**

Replace the contents of `apps/weather-app/app/app-nav.tsx` with:
```tsx
import { NavLink } from "react-router";

export function AppNav() {
  return (
    <nav className="bg-surface-muted border-border text-text flex gap-page border-b p-page">
      <NavLink to="/" end className="text-text hover:text-primary">
        Home
      </NavLink>
      <NavLink to="/about" end className="text-text hover:text-primary">
        About
      </NavLink>
    </nav>
  );
}
```

- [ ] **Step 7: Remove the legacy empty stylesheets**

Run:
```bash
git rm apps/weather-app/styles.css apps/weather-app/app/app.module.css
```
Expected: both files removed. (Both are empty and unreferenced; `app.css` is now the single global stylesheet.)

- [ ] **Step 8: Verify tokens compile into the build**

Run:
```bash
pnpm exec nx build weather-app
```
Expected: build succeeds. Then confirm a semantic token and utility compiled:
```bash
grep -r "\-\-color-primary" apps/weather-app/dist/**/*.css | head -1
```
Expected: prints a match (the `@theme` custom property is emitted to the output CSS).

- [ ] **Step 9: Verify the full quality gate**

Run:
```bash
pnpm exec nx run-many -t typecheck lint test -p weather-app
```
Expected: typecheck, lint, and test all pass.

- [ ] **Step 10: Commit**

```bash
git add apps/weather-app/app/styles/theme.css apps/weather-app/app/styles/app.css apps/weather-app/app/app.tsx apps/weather-app/app/app-nav.tsx
git commit -m "feat(weather-app): add semantic design tokens and apply to home view"
```

---

## Notes for the implementer

- **Manual visual check (optional):** `pnpm exec nx dev weather-app` then open http://localhost:4200 — the nav and home view should show the surface/text/primary colors. Not required for task completion (covered by build + test gates).
- **Later color swap:** edit only the semantic aliases (or palette values) in `app/styles/theme.css`; no component changes needed.
