# Weather BFF (GraphQL) — Design

**Date:** 2026-07-07
**Status:** Approved (design), pending implementation plan
**Context:** Backend half of the Collinson weather-ranking assessment. Adds a Node + GraphQL
API alongside the existing `apps/weather-app` React SPA. Ranks four activities (skiing, surfing,
outdoor sightseeing, indoor sightseeing) over the next 7 days for a given city, using Open-Meteo.

## Goal

Given a city name, return a ranking of how desirable each activity will be over the next 7 days,
with both an overall (7-day) score per activity and a per-day breakdown. The API is a
Backend-for-Frontend (BFF) for the React SPA.

## Stack & tooling decisions

- **GraphQL server:** Apollo Server (standalone), **SDL-first** schema. Recognizable, minimal
  wiring, no HTTP framework needed.
- **Language:** TypeScript, strict mode (inherits `tsconfig.base.json`).
- **Nx:** new Node application generated with `@nx/node`. `@nx/node` is not yet installed —
  add `@nx/node@23.0.1` to `devDependencies` **and** to `minimumReleaseAgeExclude` in
  `pnpm-workspace.yaml`, matching how the other `@nx/*` 23.0.1 packages are handled (the
  supply-chain cooldown guardrail).
- **Runtime deps** (`@apollo/server`, `graphql`) are well older than the 2-week cooldown, so they
  install without an exclude entry.
- **Testing:** Vitest (already the workspace standard).

## Architecture & layout

The app is a thin transport layer; all domain logic lives in a shared, framework-agnostic library.

```
apps/weather-bff/                  # thin Apollo transport layer
  src/
    main.ts                        # Apollo Server standalone bootstrap
    config.ts                      # port, Open-Meteo base URLs
    context.ts                     # builds request context (service instance)
    graphql/
      schema.ts                    # SDL (typeDefs)
      resolvers.ts                 # resolvers → delegate to service
  tests/

libs/weather-domain/               # pure, framework-agnostic
  src/
    integration/
      open-meteo.client.ts         # geocoding + forecast fetch → normalized types
    domain/
      weather.types.ts             # DailyWeather, Location, Activity, RankedActivity…
      scoring/
        activity-scorer.ts         # ActivityScorer interface
        skiing.scorer.ts
        surfing.scorer.ts
        outdoor-sightseeing.scorer.ts
        indoor-sightseeing.scorer.ts
        registry.ts                # list of scorers → add activity = add file
      rank-activities.ts           # pure: forecast → ranked activities
    service/
      weather-ranking.service.ts   # composes client + scoring (client injected)
    index.ts                       # public API of the lib
```

**Dependency flow:** `apps/weather-bff` → `libs/weather-domain`. The Open-Meteo client is injected
into `WeatherRankingService` so ranking stays pure and unit-testable without network access.
Enforced by Nx module boundaries (`@nx/enforce-module-boundaries` in root `eslint.config.mjs`).

## Data flow

`rankActivities("São Paulo")`:

1. **Geocode** → `GET https://geocoding-api.open-meteo.com/v1/search?name=<city>&count=1`.
   Use `results[0]`. If `results` is missing/empty → `CITY_NOT_FOUND` GraphQL error.
2. **Forecast** → `GET https://api.open-meteo.com/v1/forecast` with:
   - `latitude`, `longitude` from the geocode result
   - `daily=temperature_2m_max,temperature_2m_min,rain_sum,snowfall_sum,wind_speed_10m_max,wind_direction_10m_dominant,wind_gusts_10m_max,weather_code,precipitation_probability_max`
   - `timeformat=unixtime`, `format=json`, `timezone=auto`
3. **Normalize** — the forecast returns **columnar** parallel arrays under `daily` (7 entries).
   The client transposes them into `DailyWeather[]`, converting each `time` (unixtime) → ISO `date`.
4. **Score** — each `ActivityScorer` produces a 0–100 score per day; overall = mean of daily scores.
5. **Rank** — sort activities by `overallScore` descending.
6. Return `CityRanking { location, rankings }`.

> **Deviation from the reference curl:** we add `&timezone=auto` so daily buckets align to the
> city's local calendar day rather than UTC. Everything else matches the provided curls.

### Open-Meteo response shapes (verified 2026-07-07)

Geocoding `results[]` item (fields used): `name`, `admin1`, `country`, `latitude`, `longitude`,
`timezone`. Other fields (`id`, `elevation`, `population`, `postcodes`, …) are ignored. The
`results` key is **absent** when there are no matches.

Forecast `daily` (columnar, 7 parallel arrays): `time` (unixtime), `temperature_2m_max`,
`temperature_2m_min`, `rain_sum`, `snowfall_sum`, `wind_speed_10m_max`,
`wind_direction_10m_dominant`, `wind_gusts_10m_max`, `weather_code`, `precipitation_probability_max`.
A `daily_units` block documents units (°C, mm, cm, km/h, °, wmo code, %).

## GraphQL schema (SDL-first)

```graphql
enum Activity { SKIING SURFING OUTDOOR_SIGHTSEEING INDOOR_SIGHTSEEING }

type Location {
  name: String!          # results[].name
  admin1: String         # region, e.g. "São Paulo"
  country: String        # results[].country
  latitude: Float!
  longitude: Float!
  timezone: String!
}

type DailyWeather {
  date: String!                     # from unixtime → ISO (YYYY-MM-DD)
  weatherCode: Int!                 # weather_code (WMO)
  tempMaxC: Float!                  # temperature_2m_max
  tempMinC: Float!                  # temperature_2m_min
  rainMm: Float!                    # rain_sum
  snowfallCm: Float!                # snowfall_sum
  windSpeedMax: Float!              # wind_speed_10m_max
  windGustsMax: Float!              # wind_gusts_10m_max
  windDirectionDominant: Int!       # wind_direction_10m_dominant
  precipitationProbabilityMax: Int! # precipitation_probability_max
}

type DailyScore {
  date: String!          # ISO date
  score: Int!            # 0–100 for this activity that day
  weather: DailyWeather!
}

type ActivityRanking {
  activity: Activity!
  overallScore: Int!     # aggregate (mean) across the 7 days
  daily: [DailyScore!]!  # per-day breakdown
}

type CityRanking {
  location: Location!
  rankings: [ActivityRanking!]!   # sorted best → worst by overallScore
}

type Query {
  rankActivities(city: String!): CityRanking!
}
```

Resolver types are hand-written to match the domain types (no frontend codegen — see trade-offs).

## Scoring model (extensibility story)

Each activity implements a single strategy:

```ts
interface ActivityScorer {
  activity: Activity;
  scoreDay(day: DailyWeather): number; // 0–100
}
```

`rankActivities(forecast)` runs every scorer in the registry over all 7 days, computes each
activity's overall score as the mean of its daily scores, and sorts descending.

**Adding an activity** = add one scorer file + a registry entry + an `Activity` enum value.
No changes to transport, service, or ranking logic.

The chosen `daily=` set has **no sunshine/cloud field**, so "clear vs. overcast" is derived from
`weather_code` (WMO), combined with `precipitation_probability_max` and `rain_sum`:

- **Skiing** — rewards `snowfall_sum`, cold `temperature_2m_max`; penalizes `rain_sum` and high wind.
- **Surfing** — rewards `wind_speed_10m_max` in a good range and mild temps (wave-data
  approximation — see trade-offs).
- **Outdoor sightseeing** — rewards clear `weather_code`, low `precipitation_probability_max` /
  `rain_sum`, mild temperature, low wind.
- **Indoor sightseeing** — inverse of outdoor sightseeing: scores higher when outdoor conditions
  are poor (the bad-weather fallback).

Exact thresholds/weights are an implementation detail, chosen to be readable and defensible;
each scorer is covered by unit tests with fixed fixtures.

## Error handling

- **City not found** — geocoding returns no `results` → GraphQL error, code `CITY_NOT_FOUND`,
  clear message naming the city.
- **Upstream failure** — Open-Meteo network/HTTP error → GraphQL error, code `UPSTREAM_ERROR`.
- **Input validation** — `city` is trimmed; empty input → `BAD_USER_INPUT`.

## Testing (Vitest)

- **Scorer unit tests** — pure, deterministic `DailyWeather` fixtures asserting expected score
  direction/ranges for each activity (including edge cases: heavy snow, storm, mild clear day).
- **Service test** — `WeatherRankingService` with a mocked Open-Meteo client; asserts ranking
  order and per-day mapping. No live network.
- **Client test** — transposition of columnar arrays and unixtime→ISO conversion against a
  captured fixture; `CITY_NOT_FOUND` when `results` is absent.
- **Resolver/schema integration test** — executes `rankActivities` against the schema with a
  mocked service, asserting the response shape.

## Out of scope (YAGNI — documented as README trade-offs)

- Auth, persistence/database, response caching, GraphQL subscriptions, rate limiting.
- Frontend GraphQL codegen / shared types library.
- True surfing quality via Open-Meteo **Marine API** (wave height, coastal only) — current
  wind-based approximation is the documented shortcut; Marine API is the natural extension.
- Multi-result city disambiguation (we take the top geocoding match).
