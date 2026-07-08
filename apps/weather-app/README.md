# weather-app

React Router SPA frontend for the weather activity-ranking app. Enter a city and it shows how
desirable activities, for now, **skiing, surfing, outdoor sightseeing, and indoor sightseeing** will be over the next
7 days, using rankings served by the [`weather-bff`](../weather-bff/README.md) GraphQL API.

## Architecture

A **thin client**: it holds no ranking logic of its own. It collects a city, queries the BFF, and
renders the result. Data-fetching state (loading / error / success) is handled declaratively.

```
apps/weather-app (React Router 8, SPA mode — ssr: false)
  app/root.tsx                    document shell + QueryClientProvider (react-query)
  app/routes.tsx                  route table (index + about; not file-system routing)
  app/routes/home.tsx             search form (react-hook-form + zod), triggers a query
  app/components/
    city-rankings.tsx             useSuspenseQuery -> renders rankings for a city
    ranking-skeleton.tsx          Suspense fallback
    error-boundary.tsx            isolates fetch failures (keyed by city)
    ui/                           shadcn-style primitives (Button, Input, Form, …)
  app/graphql/
    client.ts                     rankActivities() / getLocationName() via graphql-request
    operations.ts                 typed GraphQL documents
    generated/                    graphql-codegen client-preset output (do not edit)
  app/styles/theme.css            Tailwind v4 @theme design tokens
```

Key decisions:

- **Declarative data flow.** `useSuspenseQuery` drives rendering; `<Suspense>` shows the skeleton
  and an `<ErrorBoundary keyed by city>` isolates failures, so `city-rankings.tsx` only ever
  handles the success path.
- **End-to-end type safety.** `graphql-codegen` (client preset) reads the BFF's SDL and generates
  typed documents from the queries in `operations.ts`, so the GraphQL response shape is checked at
  compile time. Regenerate with `pnpm codegen` from the repo root after schema/query changes.
- **Design tokens over hardcoded styles.** Colors and spacing are Tailwind v4 `@theme` tokens
  ([theme.css](app/styles/theme.css)) surfaced as semantic utilities (`bg-surface`, `text-text`,
  `p-page`). Components use the semantic aliases, so rebranding is a token edit — no component
  changes. The current palette is a mock placeholder.
- **Validated input.** The search form uses `react-hook-form` + `zod` for client-side validation.

## Running

```sh
pnpm exec nx serve weather-app     # dev server at http://localhost:4200/
pnpm exec nx build weather-app     # production bundle -> apps/weather-app/dist
pnpm exec nx test weather-app      # Vitest (jsdom)
```

The BFF must be running for rankings to load (`pnpm exec nx serve weather-bff`, defaults to
`http://localhost:4000/`).

Environment variables (all optional):

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_GRAPHQL_URL` | `http://localhost:4000/` | URL of the `weather-bff` GraphQL endpoint. |

## Caching & resilience

- **Client cache.** `@tanstack/react-query` caches responses per `['rankActivities', city]` key,
  so re-searching a city is served from cache without a network round-trip.
- **Error isolation.** Each search is wrapped in an `ErrorBoundary` keyed by city; a failed
  request renders a retryable message instead of crashing the page, and resets on the next search.
- **Server-side resilience** (retries, Redis cache) lives in the BFF — see its
  [README](../weather-bff/README.md).

## GraphQL

The client talks to the BFF's single `rankActivities(city)` query via `graphql-request`
([client.ts](app/graphql/client.ts)). Operations are defined in
[operations.ts](app/graphql/operations.ts):

- `RankActivities` — the full payload (location details, per-activity `overallScore`, and per-day
  scores with weather). It uses `@include` directives gated by `includeLocationDetails` /
  `includeWeather` variables so callers can trim the response to only the fields they need.
- `GetLocationName` — a lightweight lookup that resolves just the location name.

## Omissions & Trade-offs

- **No routing for results.** The searched city lives in component state, not the URL, so results
  aren't shareable/deep-linkable. A `?city=` search param would fix this.
- **Minimal presentation.** Rankings render as plain score lists; the per-day `weather` payload is
  fetched but not yet visualized. The brief prioritizes architecture over UX polish.
- **Placeholder theme.** The design tokens ship a mock palette, not the final brand.
- **No SSR.** SPA mode (`ssr: false`) keeps deployment simple at the cost of initial-load SEO.
- **No multiples cities.** The project is set to get the first city, there is no flow to resolve ambiguous cities
- **No test e2e.**
