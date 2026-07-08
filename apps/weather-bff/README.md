# weather-bff

GraphQL backend-for-frontend for the weather activity-ranking app. Given a city name, it
returns a ranking of how desirable four activities — **skiing, surfing, outdoor sightseeing,
indoor sightseeing** — will be over the next 7 days, based on [Open-Meteo](https://open-meteo.com)
data.

## Architecture

The app is a **thin transport layer**; all domain logic lives in the framework-agnostic
`@collinson/weather-domain` library (`libs/weather-domain`).

```
apps/weather-bff (Apollo Server, SDL-first)
  graphql/schema.ts     GraphQL SDL
  graphql/resolvers.ts  delegates to the domain service, maps domain errors -> GraphQL errors
  cache/redis-cache.ts  best-effort Redis adapter for the domain Cache port
  composition.ts        composition root: builds long-lived deps (cache, client, service) once
  main.ts               startStandaloneServer bootstrap + graceful shutdown
        |
        v
libs/weather-domain (pure, unit-tested, no framework deps)
  integration/open-meteo.client.ts   geocoding + forecast (fetch is dependency-injected)
  domain/scoring/*                    one ActivityScorer strategy per activity + registry
  domain/rank-activities.ts           pure: Forecast -> ranked CityRanking
  service/weather-ranking.service.ts  orchestrates geocode -> forecast -> rank
```

Key decisions:

- **Separation of concerns / testability.** The Open-Meteo client is injected into the service,
  so ranking and orchestration are unit-tested with no network access.
- **Extensible scoring.** Adding an activity = add one `ActivityScorer` + a registry entry + an
  enum value. Transport, service, and ranking code are untouched.
- **Apollo Server v5** (not v4, which is end-of-life since Jan 2026).

## Running

```sh
pnpm exec nx serve weather-bff     # dev server with watch (tsx), default http://localhost:4000/
pnpm exec nx start weather-bff     # run once (no watch)
pnpm exec nx test weather-bff      # Vitest
pnpm exec nx typecheck weather-bff
pnpm exec nx lint weather-bff
```

Environment variables (all optional):

| Var | Default | Purpose |
|-----|---------|---------|
| `PORT` | `4000` | HTTP port |
| `OPEN_METEO_GEOCODING_URL` | `https://geocoding-api.open-meteo.com/v1/search` | Geocoding endpoint |
| `OPEN_METEO_FORECAST_URL` | `https://api.open-meteo.com/v1/forecast` | Forecast endpoint |
| `REDIS_URL` | *(unset)* | Redis connection; unset disables caching |
| `GEOCODE_TTL_SECONDS` | `2592000` | Geocode cache TTL (30 days) |
| `FORECAST_TTL_SECONDS` | `3600` | Forecast cache TTL (1 hour) |
| `UPSTREAM_TIMEOUT_MS` | `5000` | Per-attempt Open-Meteo fetch timeout |
| `UPSTREAM_MAX_RETRIES` | `2` | Retries after the first attempt (5xx/timeout/network) |

## Caching & resilience

Open-Meteo calls are cached per upstream request (geocoding + forecast) through a `Cache`
port defined in the domain lib. In production the port is backed by Redis; caching is
**best-effort**, so if Redis is unreachable the request degrades to a live upstream call.
The upstream fetch itself has an `AbortController` timeout and bounded retry with backoff
(retrying timeouts, network errors, and 5xx — never 4xx).

Start Redis for local dev:

```sh
docker compose up -d redis
export REDIS_URL=redis://localhost:6379
pnpm exec nx serve weather-bff
```

If `REDIS_URL` is unset, caching is disabled (a no-op cache is used) and the app runs
without Redis.

## GraphQL

```graphql
query {
  rankActivities(city: "Lisbon") {
    location { name country }
    rankings {
      activity
      overallScore            # rounded mean of the 7 daily scores, sorted best -> worst
      daily { date score weather { weatherCode tempMaxC tempMinC windSpeedMax } }
    }
  }
}
```

Errors surface with a stable `extensions.code`: `CITY_NOT_FOUND`, `UPSTREAM_ERROR`, `BAD_USER_INPUT`.

## Scoring model

Each activity has a scorer producing a 0–100 score per day (mean = overall):

- **Skiing** — rewards snowfall and cold; penalizes rain and strong wind.
- **Surfing** — rewards a good wind band and mild temperature (wind is a proxy — see trade-offs).
- **Outdoor sightseeing** — rewards clear skies (from WMO `weather_code`), mild temperature,
  low precipitation probability and low wind.
- **Indoor sightseeing** — the inverse of outdoor: scores higher when outdoor conditions are poor.

## Omissions & Trade-offs

- **Surfing uses wind as a proxy** for wave quality. Real surf scoring needs Open-Meteo's
  separate Marine API (wave height/period, coastal only) — the natural next step.
- **Top geocoding match only.** We take `results[0]`; no disambiguation for ambiguous names.
- **Runs via `tsx`, not a compiled bundle.** The workspace TS base emits declarations only, so a
  production build would add esbuild/`@nx/esbuild`. Deferred as it adds no behavioural value here.
- **Upstream calls are cached in Redis** (geocode + forecast, per call, best-effort). Rate
  limiting, auth, and persistence remain out of scope.
