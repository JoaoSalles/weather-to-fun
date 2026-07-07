# Design: City ranking form on the home route

**Date:** 2026-07-07
**Status:** Approved (pending spec review)

## Goal

Add a form to the `weather-app` home route ([home.tsx](../../../apps/weather-app/app/routes/home.tsx))
with a single **city** input and a submit button. Submitting calls the `weather-bff`
GraphQL server's `rankActivities` query and renders the returned activity rankings, including
a 7-day per-day breakdown. Frontend types are **generated from the server's GraphQL schema**
via GraphQL Code Generator, so the query and its result/variables are fully typed end-to-end.

## Context

- `weather-app` is a React Router 7 SPA (`ssr: false`).
- The BFF exposes `rankActivities(city: String!): CityRanking!` — see
  [resolvers.ts](../../../apps/weather-bff/src/graphql/resolvers.ts) and
  [schema.ts](../../../apps/weather-bff/src/graphql/schema.ts). It runs via Apollo
  `startStandaloneServer` (default port 4000, CORS enabled by default).
- The SDL in `schema.ts` is a 1:1 mirror of the domain types in
  [weather.types.ts](../../../libs/weather-domain/src/domain/weather.types.ts). Domain types
  are the true single source of truth; the SDL mirrors them, and the frontend types are
  generated from the SDL. Chain: **domain types → SDL → generated frontend types**.
- No GraphQL client and no shadcn are currently installed on the frontend.

## Decisions (resolved during brainstorming)

| Topic | Decision |
| --- | --- |
| Type sharing | **GraphQL Code Generator**, SDL-derived. No shared contract lib. |
| Document typing | **`TypedDocumentNode`** via codegen `client-preset`. |
| Fragment masking | **Off** (`fragmentMasking: false`) — direct field access, single query, no fragments. |
| Frontend call | **TanStack Query** `useSuspenseQuery` (client-side cache) + **`graphql-request`** fetcher. |
| Loading UI | **React Suspense** with a shadcn `Skeleton` fallback. |
| Error UI | Hand-rolled class **`ErrorBoundary`** (`key={city}` resets per search), dep-free. |
| Form | **Full shadcn Form** stack: `react-hook-form` + `zod` + `@hookform/resolvers`. |
| Result rendering | Ranked list (best→worst, overall score) **plus** 7-day per-day breakdown. |

## Why no shared `weather-contract` lib

Codegen replaces hand-shared types. The SDL only needs to be *read* by codegen (the root
`codegen.ts` imports `typeDefs` from the BFF — no runtime package boundary). Operations and
generated types are frontend-only (the BFF has resolvers, not typed documents), so they live
inside `weather-app`. `typeDefs` therefore stays in the BFF — unchanged.

## Architecture

```
domain types ──► SDL (apps/weather-bff/.../schema.ts, typeDefs)
                     │
                     │  codegen.ts reads typeDefs as `schema`
                     ▼
        apps/weather-app/app/graphql/generated/   (TypedDocumentNode + types, committed)
                     ▲
                     │  graphql() wraps the operation
        apps/weather-app/app/graphql/operations.ts   (RANK_ACTIVITIES)
                     │
   home.tsx ──► CityRankings ──► useSuspenseQuery(queryFn: request(URL, RANK_ACTIVITIES, {city}))
                     │
                     ▼
             weather-bff GraphQL (rankActivities resolver)
```

## Components

### 1. GraphQL Code Generator

- **`codegen.ts`** (repo root): `import { typeDefs } from './apps/weather-bff/src/graphql/schema'`;
  config `schema: typeDefs`, `documents: ['apps/weather-app/app/**/*.{ts,tsx}']`,
  `generates: { 'apps/weather-app/app/graphql/generated/': { preset: 'client', presetConfig: { fragmentMasking: false } } }`.
- **`pnpm codegen`** script runs codegen; it must run before `typecheck`/`build` and after any
  schema change. Generated output is committed to the repo.
- Dev deps: `@graphql-codegen/cli`, `@graphql-codegen/client-preset`.

### 2. Operation

- **`apps/weather-app/app/graphql/operations.ts`**:
  ```ts
  import { graphql } from './generated';
  export const RANK_ACTIVITIES = graphql(`
    query RankActivities($city: String!) {
      rankActivities(city: $city) {
        location { name admin1 country latitude longitude timezone }
        rankings {
          activity
          overallScore
          daily {
            date
            score
            weather {
              date weatherCode tempMaxC tempMinC rainMm snowfallCm
              windSpeedMax windGustsMax windDirectionDominant precipitationProbabilityMax
            }
          }
        }
      }
    }
  `);
  ```
  Typed as `TypedDocumentNode<RankActivitiesQuery, RankActivitiesQueryVariables>`.

### 3. Data layer

- **GraphQL endpoint config:** `import.meta.env.VITE_GRAPHQL_URL` with default
  `http://localhost:4000/`.
- **`QueryClientProvider`** added in [root.tsx](../../../apps/weather-app/app/root.tsx); the
  `QueryClient` held in `useState` for a stable instance.
- **Fetcher:** `graphql-request`'s `request(GQL_URL, RANK_ACTIVITIES, variables)` — infers
  result + variables from the `TypedDocumentNode`.

### 4. Home route ([home.tsx](../../../apps/weather-app/app/routes/home.tsx))

- Full shadcn **Form** (`react-hook-form` + `zod` resolver). Schema: `city` is a trimmed,
  non-empty string; `FormMessage` shows the validation error. Valid submit → `setCity(values.city)`.
- Committed `city` state drives result rendering:
  ```tsx
  {city && (
    <ErrorBoundary key={city}>
      <Suspense fallback={<RankingSkeleton />}>
        <CityRankings city={city} />
      </Suspense>
    </ErrorBoundary>
  )}
  ```

### 5. `CityRankings` component

- `useSuspenseQuery({ queryKey: ['rankActivities', city], queryFn: () => request(GQL_URL, RANK_ACTIVITIES, { city }) })`.
- Renders `location.name` (+ country), then `rankings` (already sorted best→worst by the BFF)
  with each activity's `overallScore` (0–100), each expanded to its 7-day `daily` scores.
- Types come from the generated `RankActivitiesQuery` (SDL-derived, masking off → direct access).

### 6. `ErrorBoundary`

- Small hand-rolled class component (no `react-error-boundary` dep). Catches thrown errors from
  the suspense query and renders the message inline. `key={city}` on the boundary resets it on
  the next search.

### 7. shadcn setup

- `shadcn init` (Tailwind v4 compatible; project already has `@tailwindcss/vite` and design tokens
  in [theme.css](../../../apps/weather-app/app/styles/theme.css)). Adds `components.json`, the `cn`
  util, and components: **Form, Input, Button, Label, Skeleton**.
- Utility deps pulled in by shadcn: `clsx`, `tailwind-merge`, `class-variance-authority`,
  relevant `@radix-ui/*` (e.g. `@radix-ui/react-label`, `@radix-ui/react-slot`).

## Data flow

1. User types a city, submits the shadcn Form.
2. zod validates (non-empty). On success, `setCity(value)`.
3. `<CityRankings city={city}>` mounts under `<Suspense>`; `useSuspenseQuery` suspends → skeleton shows.
4. `graphql-request` POSTs `RANK_ACTIVITIES` + `{ city }` to the BFF.
5. Resolved data renders as the ranked list + per-day breakdown; TanStack caches it per city
   (re-searching a cached city resolves instantly).

## Error handling

- **Empty input:** blocked client-side by the zod schema (`FormMessage`).
- **Network failure / GraphQL `errors[]`** (e.g. `CityNotFound`, `InvalidInput` from the resolver):
  `graphql-request` throws → caught by `ErrorBoundary` → message shown inline; `key={city}` resets
  on the next search.

## Testing

- **Codegen sanity:** `pnpm codegen` produces the generated dir; `tsc` type-checks the operation
  and consumers (compile-time guarantee that the query matches the schema).
- **`CityRankings` / home route** (Testing Library + a test `QueryClient`, `graphql-request` mocked):
  - loading → skeleton fallback renders;
  - success → location name, activities in order with scores, per-day rows;
  - error → `ErrorBoundary` message renders;
  - form validation → empty submit shows the zod message and does not fire a request.

## Dependencies (2-week package-age guardrail applies)

- **Runtime:** `graphql-request`, `@tanstack/react-query`, `react-hook-form`, `zod`,
  `@hookform/resolvers`, plus shadcn utils (`clsx`, `tailwind-merge`, `class-variance-authority`, `@radix-ui/*`).
- **Dev:** `@graphql-codegen/cli`, `@graphql-codegen/client-preset`.
- Any package published < 2 weeks ago must be added to `minimumReleaseAgeExclude` in
  `pnpm-workspace.yaml`.

## Out of scope

- Autocomplete/geocoding suggestions for the city input.
- Persisting search history beyond the in-memory TanStack cache.
- SSR/loader-based fetching (SPA + client-side suspense only).
- Styling/design polish beyond shadcn defaults + existing tokens.
