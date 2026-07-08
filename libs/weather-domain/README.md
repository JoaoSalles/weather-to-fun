# weather-domain

Pure, framework-agnostic domain logic for the weather activity-ranking app. Given a city name it
resolves a location, fetches an [Open-Meteo](https://open-meteo.com) 7-day forecast, and scores how
desirable **skiing, surfing, outdoor sightseeing, and indoor sightseeing** will be on each day.

This library holds **all the business logic**. The [`weather-bff`](../../apps/weather-bff/README.md)
is a thin GraphQL layer on top of it; the library itself has no framework, HTTP, or GraphQL
dependencies (only `tslib`), so it can be unit-tested in isolation and reused from any transport.

## Architecture

```
libs/weather-domain/src
  index.ts                              public API (types, service, client, cache, scorers)
  domain/
    weather.types.ts                    core types: DailyWeather, Forecast, CityRanking, Activity…
    errors.ts                           CityNotFoundError, UpstreamError, InvalidInputError
    rank-activities.ts                  pure: Forecast -> ranked CityRanking (sorted best->worst)
    scoring/
      activity-scorer.ts                ActivityScorer port: scoreDay(day) -> 0..100
      skiing | surfing |
      outdoor-sightseeing |
      indoor-sightseeing.scorer.ts      one scoring strategy per activity
      registry.ts                       the list of active scorers
      score-utils.ts                    clampScore() and shared helpers
  integration/
    open-meteo.client.ts                geocoding + forecast HTTP client (fetch injected)
  service/
    weather-ranking.service.ts          orchestrates geocode -> forecast -> rank
    caching-weather-provider.ts         decorator that caches geocode/forecast via a Cache port
  cache/
    cache.port.ts                       Cache interface (get/set with TTL)
    noop-cache.ts                       default no-op implementation
```

Data flow: `WeatherRankingService.rankForCity(city)` → `WeatherProvider.geocode` →
`WeatherProvider.fetchForecast` → pure `rankActivities(forecast)`.

Key decisions:

- **Ports & adapters (hexagonal).** The service depends on a `WeatherProvider` interface, not on
  `OpenMeteoClient` directly, and caching is a `WeatherProvider` decorator (`CachingWeatherProvider`)
  rather than logic baked into the client. `Cache` is likewise a port — the library ships a
  `NoopCache`, and the BFF supplies a Redis adapter. Swapping the weather source, cache, or adding
  a decorator requires no change to the scoring or service code.
- **Strategy pattern for scoring.** Each activity is an `ActivityScorer` with a single
  `scoreDay(day) -> 0..100` method, registered in [registry.ts](src/domain/scoring/registry.ts).
  Adding an activity = new scorer + registry entry + a value in the `Activity` union; ranking,
  service, and transport are untouched.
- **Pure ranking core.** `rankActivities()` is a pure function (`Forecast -> CityRanking`): it
  scores every day per activity, averages to an `overallScore`, and sorts best→worst. Trivially
  unit-testable with fixture forecasts, no network.
- **Injected `fetch`.** `OpenMeteoClient` takes a `fetchFn` (and base URLs) via options, so HTTP
  behaviour — retries, timeouts, error mapping — is tested with a stub `fetch`.
- **Domain-specific errors.** `CityNotFoundError`, `UpstreamError`, and `InvalidInputError` let the
  transport layer map failures to meaningful responses instead of leaking raw HTTP/network errors.

## Running

This is a library — it's consumed by the BFF, not run on its own. Work on it via Nx:

```sh
pnpm exec nx test weather-domain        # Vitest unit tests (co-located *.spec.ts)
pnpm exec nx lint weather-domain
pnpm exec nx typecheck weather-domain
```

Every unit is covered by a co-located spec (scorers, ranking, service, caching provider, and the
Open-Meteo client with a stubbed `fetch`).

## Caching & resilience

- **Caching** is opt-in via `CachingWeatherProvider`, which wraps any `WeatherProvider` and caches
  geocode results (keyed by lowercased city) and forecasts (keyed by rounded lat/long) with
  independent TTLs (`CacheTtls`) through the `Cache` port. The library defaults to `NoopCache`; the
  BFF injects Redis.
- **Resilience** lives in `OpenMeteoClient`: per-request timeout via `AbortController` (default 5s),
  bounded retries with exponential backoff (default 2 retries, 200ms base) on 5xx/network errors,
  and **no retry on 4xx** (client errors are surfaced as `UpstreamError` immediately). A missing
  geocoding result becomes `CityNotFoundError`.

## Omissions & Trade-offs

- **Heuristic scoring.** The scoring weights (e.g. snow/cold/rain/wind thresholds for skiing) are
  reasonable but hand-tuned, not empirically validated. They're isolated per scorer, so tuning one
  activity can't affect the others.
- **Single geocoding match.** `geocode` takes the first Open-Meteo result (`count=1`); it doesn't
  disambiguate same-named cities or expose alternatives.
- **In-memory / external cache only.** The library defines the `Cache` port but ships only a
  `NoopCache`; any real cache (Redis, etc.) is the consumer's responsibility.
- **No cross-day/seasonal context.** Each day is scored independently from that day's forecast;
  there's no notion of trend, season, or historical baselines.
