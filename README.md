# Weather to fun

This is a setup project for a fullstack project where the user can check for weather conditions for kind of activities  

## Projects

| Project | Type | Description |
|---------|------|-------------|
| `apps/weather-app` | React Router SPA | Frontend. See [apps/weather-app/README.md](apps/weather-app/README.md).
| `apps/weather-bff` | Node + GraphQL (Apollo Server) | Backend-for-frontend that ranks activities from Open-Meteo data. See [apps/weather-bff/README.md](apps/weather-bff/README.md). |
| `libs/weather-domain` | TypeScript library | Pure, framework-agnostic domain logic (Open-Meteo client, activity scoring, ranking) shared by the BFF. See [libs/weather-domain/README.md](libs/weather-domain/README.md)

## Clean architecture

The project separates **business logic** from **delivery mechanisms**. All ranking, scoring, and
Open-Meteo integration lives in the framework-agnostic `libs/weather-domain` library — it has no
HTTP, GraphQL, or React dependencies (only `tslib`), so it can be unit-tested in isolation and
reused from any transport. The `apps/*` are thin layers on top of it:

- **`apps/weather-bff`** is a thin GraphQL transport. Its resolvers delegate to the domain service
  and map domain errors onto GraphQL errors; its `composition.ts` is the composition root that
  wires the concrete dependencies (Open-Meteo client, cache, service) together once at startup.
- **`apps/weather-app`** is a thin client that holds no ranking logic — it collects a city, queries
  the BFF, and renders the result.

Dependencies point **inward**: apps depend on the domain library, never the reverse. Adding a new
activity means adding one `ActivityScorer` strategy plus a registry entry inside the library — the
transport, service, and ranking code stay untouched.

Nx makes this division practical: the domain lib is a first-class project with its own build and
test targets, and ESLint's `@nx/enforce-module-boundaries` rule (configured in the root
`eslint.config.mjs`) enforces the layering so an app can't reach around the public API or a lib
can't import an app. See the per-project READMEs for the detailed module maps:
[weather-domain](libs/weather-domain/README.md), [weather-bff](apps/weather-bff/README.md),
[weather-app](apps/weather-app/README.md).

## Cache

Caching happens on both sides of the wire.

**Client side.** The SPA uses TanStack Query (`@tanstack/react-query`). Rankings are read with
`useSuspenseQuery` keyed by city (`['rankActivities', city]`), so repeated lookups of the same city
are served from the in-memory query cache instead of re-hitting the BFF, and Suspense/error
boundaries fall out of the same mechanism.

**Server side.** `CachingWeatherProvider` decorates the Open-Meteo client with a read-through cache
behind a `Cache` port. The backend is injected at the composition root — a no-op in dev/test, or
Redis (`REDIS_URL`) in production — so the service never has to think about cache misses. Geocode
and forecast results are cached separately with independent TTLs (geocode ~30 days, forecast
~1 hour) because a city's coordinates are effectively static while its forecast is not.

**Cache-stampede prevention.** Each read-through is wrapped in a per-process `SingleFlight`: when
many callers miss the cache for the same key at once, only the first triggers the upstream call and
the rest await its result. The cache read stays *inside* the single-flight so late-joining callers
still observe the value the leader just wrote. This deduplicates per replica;

**cross-instance**: deduplication would need a distributed lock (e.g. Redis `SETNX`/redlock), which is called out as a
deliberate trade-off. See [caching-weather-provider.ts](libs/weather-domain/src/utils/caching-weather-provider.ts)
and [single-flight.ts](libs/weather-domain/src/utils/single-flight.ts) (not implemented).


## Re-try

Every call to Open-Meteo goes through a single `getJson` helper in the
[OpenMeteoClient](libs/weather-domain/src/integration/open-meteo.client.ts) that wraps `fetch` with
timeouts and retries, so both geocoding and forecast requests get the same resilience for free.

- **Per-attempt timeout.** Each attempt is bounded by an `AbortController` (`UPSTREAM_TIMEOUT_MS`,
  default 5000 ms), so a hung upstream connection is aborted rather than blocking the request
  indefinitely.
- **Exponential backoff.** On a retryable failure the client waits `retryBaseDelayMs * 2 ** (attempt - 1)`
  (200 ms, then 400 ms, …) before the next try, giving a struggling upstream room to recover
  instead of hammering it.
- **Retry only what's worth retrying.** `5xx` responses, network errors, and timeouts are treated as
  transient and retried up to `UPSTREAM_MAX_RETRIES` times (default 2, i.e. 3 attempts total).
  `4xx` responses are caller errors — they fail fast as an `UpstreamError` with no retry. When all
  attempts are exhausted the last error is surfaced as an `UpstreamError`.

Both limits are configurable at the composition root via `UPSTREAM_TIMEOUT_MS` and
`UPSTREAM_MAX_RETRIES` ([config.ts](apps/weather-bff/src/config.ts)), so the retry budget can be
tuned per environment without touching the domain code. Retry pairs naturally with the caching and
single-flight layers above: a cache hit skips the network entirely, and single-flight ensures a
retry storm for the same key is collapsed into one in-flight request.


## CI (Not implemented)

A GitHub Actions deploy pipeline is not wired up yet, but the repo is structured so that one can be
**incremental**. `nx affected -t build test lint typecheck` runs targets only for the projects
touched by a change (and their dependents), computed from the project graph — so a change to the
frontend does not rebuild or redeploy the BFF, and vice versa. 

Combined with Nx's computation cache
(local, and Nx Cloud remote if enabled), CI re-runs only what actually changed instead of the whole
monorepo, keeping pipelines fast as the workspace grows.

A minimal pipeline would run `nx affected -t lint test typecheck build` on pull requests, then a
per-project deploy step gated on whether that project was affected.

## NX

Nx manages this repo as a single **pnpm-workspace monorepo** (`apps/*`, `libs/*`) so the frontend,
BFF, and shared domain library live and version together — one lockfile, one dependency set, no
publishing a package to share code between the app and the API. Key benefits used here:

- **Project graph & task orchestration.** Nx infers each project's targets (build, test, lint,
  typecheck, e2e) from config files — there are no `project.json` files. `dependsOn: ["^build"]`
  ensures a lib is built before the apps that consume it, and `nx run-many` / `nx affected` fan
  tasks out across only the relevant projects.
- **Computation caching.** Target results are cached by input hash, so unchanged projects are
  restored from cache instead of re-run — the basis for the incremental CI above.
- **Enforced boundaries.** `@nx/enforce-module-boundaries` keeps the clean-architecture layering
  honest (apps → libs, never the reverse).

**Tree-shaking** is handled by the bundlers Nx configures (Vite for the app), not Nx itself: the
domain library ships as ES modules with a single public entry (`libs/weather-domain/src/index.ts`),
so consumers only bundle the exports they actually import and dead code is dropped from production
builds.


## IA use

This project is heavly AI assisted, the AI was spec driven using pluggins to brainstorm, spec and plan.
It can be checked on [docs](docs)


## graphql-codegen 



```sh
pnpm codegen
```

## Tech Stack

**Language & tooling**
- **TypeScript** (strict mode) across every project
- **Nx 23** monorepo with **pnpm** workspaces (`apps/*`, `libs/*`)
- **Vite 8** bundler, **Vitest 4** unit tests (jsdom), **Playwright** e2e
- **ESLint** + **Prettier**; `@nx/enforce-module-boundaries` for architecture layering

**Frontend — `apps/weather-app`**
- **React 19** + **React Router 7** (SPA mode, `ssr: false`)
- **TanStack Query** for data fetching and client-side caching
- **React Hook Form** + **Zod** for form handling and validation
- **Tailwind CSS 4**, **Radix UI**, **lucide-react**, `class-variance-authority` / `clsx` / `tailwind-merge`
- **graphql-request** as the typed GraphQL client

**Backend — `apps/weather-bff`**
- **Node.js** + **Apollo Server 5** on **Express 5** (`@as-integrations/express5`)
- **GraphQL** schema-first API
- **Redis** for server-side read-through caching (optional, injected at the composition root)

**Domain — `libs/weather-domain`**
- Pure, framework-agnostic **TypeScript** (only `tslib`) — Open-Meteo client, activity scoring, ranking

**Code generation**
- **GraphQL Code Generator** (`@graphql-codegen/cli` + client preset) — see `pnpm codegen`

**External data**
- **[Open-Meteo](https://open-meteo.com)** geocoding + forecast APIs


## To run locally

run backend
```bash
 pnpm exec nx serve weather-bff
```
run frontend
```bash
 pnpm exec nx dev weather-app
```

check browser at http://localhost:4200/

## APIs documentation:

 - https://open-meteo.com/en/docs/geocoding-api
 - https://open-meteo.com/en/docs
