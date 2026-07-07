# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Goal

Build a web app that takes a city/town and ranks how desirable it will be to visit over the
next 7 days for **skiing, surfing, outdoor sightseeing, and indoor sightseeing**, based on
weather data from the [Open-Meteo](https://open-meteo.com) API. See [projectGoal.md](projectGoal.md)
for the full brief. Required stack per the brief: **React, Node.js, GraphQL, TypeScript**.

Deliverables emphasize architecture (separation of concerns, extensibility, scaling) over UX
polish, and the README must document technical choices, how AI assisted, and omissions/trade-offs.

## Current State

The repo is an Nx scaffold. `apps/weather-app` is a starter React Router SPA with only `index`
and `about` routes — **the backend (Node/GraphQL API), Open-Meteo integration, and activity
ranking logic are not yet built.** No shared libraries exist under a `libs/` or `packages/` dir yet.

## Stack

- **Nx 23** monorepo, **pnpm** workspaces (`apps/*`). Projects and their targets are
  *inferred* by Nx plugins from config files (Vite, React Router, ESLint, Vitest, Playwright) —
  there are no `project.json` files.
- **React 19** + **React Router 7** in SPA mode (`ssr: false` in `react-router.config.ts`).
- **Vite 8** bundler, **Vitest 4** unit tests (jsdom), **Playwright** e2e (`apps/weather-app-e2e`).
- TypeScript strict mode; shared config in `tsconfig.base.json`.

## Commands

Run tasks through Nx (targets are inferred — use `pnpm exec nx show project weather-app` to list them):

```sh
pnpm exec nx dev weather-app          # dev server (React Router)
pnpm exec nx build weather-app        # production bundle
pnpm exec nx test weather-app         # Vitest (defaults to WATCH mode — see nx.json testMode)
pnpm exec nx test-ci weather-app      # Vitest single run (CI)
pnpm exec nx lint weather-app         # ESLint
pnpm exec nx typecheck weather-app    # tsc type check
pnpm exec nx e2e weather-app-e2e      # Playwright e2e

pnpm exec nx run-many -t test lint typecheck   # across all projects
pnpm exec nx affected -t test                  # only projects affected by current changes
```

Run a single unit test file (pass Vitest args after `--`):

```sh
pnpm exec nx test weather-app -- tests/routes/_index.spec.tsx
pnpm exec nx test weather-app -- -t "test name substring"
```

## Conventions & Gotchas

- **Supply-chain guardrail**: `pnpm-workspace.yaml` sets `minimumReleaseAge: 20160` (2 weeks),
  so pnpm refuses packages published less than 2 weeks ago. To add a newer package you must add
  it to `minimumReleaseAgeExclude`. Keep this policy in mind when adding dependencies.
- New apps/libs should be generated with Nx so targets are inferred correctly:
  `pnpm exec nx g @nx/react:app <name>` / `pnpm exec nx g @nx/js:lib <name>`.
- React Router routes are declared in `apps/weather-app/app/routes.tsx` (not file-system routing).
- ESLint enforces Nx **module boundaries** (`@nx/enforce-module-boundaries` in the root
  `eslint.config.mjs`) — respect project/tag boundaries when wiring apps to shared libs.
