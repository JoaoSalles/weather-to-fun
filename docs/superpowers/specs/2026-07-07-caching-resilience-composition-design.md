# Design: Redis caching, upstream resilience & singleton composition

**Date:** 2026-07-07
**Status:** Approved (design), pending implementation plan
**Scope:** `weather-bff` app + `weather-domain` lib

## Problem

The backend is cleanly layered but naive for production scale. Three gaps:

1. **No caching.** `OpenMeteoClient` hits Open-Meteo on every request. Geocoding is
   effectively static and forecasts change slowly, so every request pays full upstream
   latency and burns rate limit.
2. **No upstream timeout/retry.** `getJson()` awaits `fetch` with no `AbortController`
   timeout — a hanging upstream hangs the request indefinitely — and no retry on
   transient failures.
3. **Per-request dependency construction.** `buildContext()` is Apollo's `context`
   factory, so it builds a new `OpenMeteoClient` + `WeatherRankingService` on every
   request. Cheap today, but wrong once those hold state (cache, connections).

## Goals

- Cache upstream calls in Redis (single-instance now, horizontally scalable later).
- Make the upstream fetch resilient: timeout + bounded retry.
- Build long-lived dependencies once at startup; keep `context` per-request-thin.
- Keep the domain lib free of infrastructure dependencies (no Redis import in `weather-domain`).
- Leave existing resolver behavior and tests unchanged.

## Non-goals (YAGNI for this test)

- Whole-`CityRanking` result caching (we cache per upstream call instead).
- Circuit breaker, cache-invalidation endpoints, cache stampede/lock protection.
- Application Dockerfile / containerizing the BFF (compose ships Redis only).
- Upstream-response schema validation (`zod`) — tracked separately as gap #7.

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Cache backend | Redis via docker-compose |
| Redis client | `redis` (node-redis, official) |
| Cache granularity | Per upstream call (geocode + forecast separately) |
| Cache placement | Decorator around the `WeatherProvider` port |
| Redis-down behavior | Best-effort: log warning, fall through to upstream |
| Upstream resilience | Timeout + bounded retry (no circuit breaker) |

## Architecture

Dependency direction stays clean: **app → domain port ← Redis adapter**. The domain
defines the `Cache` port; the Redis adapter lives in the app and is injected at the
composition root.

```
main.ts
  └─ composeServices(config)            [weather-bff/src/composition.ts]
       ├─ RedisCache | NoopCache        implements Cache        (adapter / port)
       ├─ OpenMeteoClient               implements WeatherProvider (timeout+retry)
       ├─ CachingWeatherProvider        implements WeatherProvider (decorator, holds Cache)
       └─ WeatherRankingService         (unchanged; depends on WeatherProvider)
```

### New in `weather-domain` (pure — no infra deps)

**`src/cache/cache.port.ts`** — the port:

```ts
export interface Cache {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
}
```

Values must be JSON-serializable (the Redis adapter serializes with `JSON.stringify`).

**`src/cache/noop-cache.ts`** — `NoopCache implements Cache`: `get` resolves
`undefined`, `set` resolves without effect. Used when caching is disabled (no
`REDIS_URL`) so local dev and tests need no Redis and emit no warnings.

**`src/service/caching-weather-provider.ts`** — `CachingWeatherProvider implements
WeatherProvider`, decorating an inner `WeatherProvider` plus a `Cache` and a TTL config:

```ts
export interface CacheTtls {
  geocodeSeconds: number;
  forecastSeconds: number;
}

export class CachingWeatherProvider implements WeatherProvider {
  constructor(
    private readonly inner: WeatherProvider,
    private readonly cache: Cache,
    private readonly ttls: CacheTtls,
  ) {}

  async geocode(city: string): Promise<Location> {
    const key = `geocode:${city.trim().toLowerCase()}`;
    const cached = await this.cache.get<Location>(key);
    if (cached) return cached;
    const location = await this.inner.geocode(city);
    await this.cache.set(key, location, this.ttls.geocodeSeconds);
    return location;
  }

  async fetchForecast(location: Location): Promise<Forecast> {
    const key = `forecast:${location.latitude.toFixed(2)}:${location.longitude.toFixed(2)}`;
    const cached = await this.cache.get<Forecast>(key);
    if (cached) return cached;
    const forecast = await this.inner.fetchForecast(location);
    await this.cache.set(key, forecast, this.ttls.forecastSeconds);
    return forecast;
  }
}
```

Because it implements the existing `WeatherProvider` interface, `WeatherRankingService`
requires no change. Forecast keys round lat/lon to 2 decimals (~1.1 km) so nearby
lookups share a cached forecast.

Exported from `weather-domain`'s `src/index.ts`: `Cache`, `NoopCache`,
`CachingWeatherProvider`, `CacheTtls`.

### New in `weather-bff` (infrastructure / composition)

**`src/cache/redis-cache.ts`** — `RedisCache implements Cache`, wrapping a connected
node-redis client. **Best-effort:** every operation is wrapped in try/catch; on error it
logs a warning and returns `undefined` (get) or resolves (set), so the request falls
through to upstream and the app keeps working when Redis is unreachable.

```ts
export class RedisCache implements Cache {
  constructor(
    private readonly client: RedisClientType,
    private readonly logger: Pick<Console, 'warn'> = console,
  ) {}

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : undefined;
    } catch (err) {
      this.logger.warn(`RedisCache.get failed for ${key}: ${String(err)}`);
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), { EX: ttlSeconds });
    } catch (err) {
      this.logger.warn(`RedisCache.set failed for ${key}: ${String(err)}`);
    }
  }
}
```

## Upstream resilience — inside `OpenMeteoClient`

Extend `OpenMeteoClientOptions`:

```ts
export interface OpenMeteoClientOptions {
  fetchFn?: FetchFn;
  geocodingBaseUrl?: string;
  forecastBaseUrl?: string;
  timeoutMs?: number;        // default 5000
  maxRetries?: number;       // default 2 (i.e. up to 3 attempts)
  retryBaseDelayMs?: number; // default 200
}
```

`getJson()` gains a retry loop:

- Each attempt uses an `AbortController` with `setTimeout(timeoutMs)` passed as `fetch`'s
  `signal`; the timer is always cleared in a `finally`.
- **Retryable** failures: timeout/abort, network/fetch rejection, and HTTP **5xx**.
  Retry with exponential backoff `retryBaseDelayMs * 2^attempt`, up to `maxRetries`.
- **Non-retryable:** HTTP **4xx** → throw `UpstreamError` immediately. `CityNotFoundError`
  is unaffected (thrown in `geocode`, above `getJson`).
- After exhausting retries, throw `UpstreamError` describing the last failure.

## Singleton composition root

**`src/composition.ts`** — `composeServices(config)` runs once at startup and returns a
handle with the singleton service and a shutdown hook:

```ts
export interface Services {
  service: WeatherRankingService;
  shutdown: () => Promise<void>;
}

export async function composeServices(config: Config): Promise<Services> {
  // 1. Cache: RedisCache when config.redisUrl is set (connect client), else NoopCache.
  // 2. const client = new OpenMeteoClient({ ...urls, timeoutMs, maxRetries });
  // 3. const provider = new CachingWeatherProvider(client, cache, ttls);
  // 4. const service = new WeatherRankingService(provider);
  // shutdown(): disconnect the redis client if one was created.
}
```

**`main.ts`** calls `composeServices` once; Apollo's `context` closes over the singleton:

```ts
const { service, shutdown } = await composeServices(config);
const server = new ApolloServer<GraphQLContext>({ typeDefs, resolvers });
const { url } = await startStandaloneServer(server, {
  context: async () => ({ service }),
  listen: { port: config.port },
});
for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => { void shutdown().finally(() => process.exit(0)); });
}
```

`GraphQLContext` in `resolvers.ts` stays `{ service }`, so the existing resolver tests are
untouched. `context.ts` is superseded by `composition.ts` and removed.

## Config & infrastructure

**`src/config.ts`** additions (all env-overridable):

| Field | Env var | Default | Meaning |
|---|---|---|---|
| `redisUrl` | `REDIS_URL` | *(unset)* | Unset ⇒ `NoopCache` (cache disabled) |
| `geocodeTtlSeconds` | `GEOCODE_TTL_SECONDS` | `2592000` (30d) | Geocode cache TTL |
| `forecastTtlSeconds` | `FORECAST_TTL_SECONDS` | `3600` (1h) | Forecast cache TTL |
| `upstreamTimeoutMs` | `UPSTREAM_TIMEOUT_MS` | `5000` | Per-attempt fetch timeout |
| `upstreamMaxRetries` | `UPSTREAM_MAX_RETRIES` | `2` | Retries after first attempt |

**`docker-compose.yml`** (repo root) — Redis only:

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
```

README note: `docker compose up -d redis` and set `REDIS_URL=redis://localhost:6379`; the
BFF continues to run via `nx dev weather-bff`.

**Dependency:** add `redis` (node-redis) to `weather-bff`. It is long-stable, so the
2-week `minimumReleaseAge` guardrail passes with no `minimumReleaseAgeExclude` entry.

## Error handling summary

| Failure | Behavior |
|---|---|
| Redis unreachable / get/set throws | Warn + fall through to upstream (best-effort) |
| `REDIS_URL` unset | `NoopCache` — no caching, no warnings |
| Upstream timeout / network error / 5xx | Retry with backoff; then `UpstreamError` |
| Upstream 4xx | `UpstreamError` immediately (no retry) |
| City not found | `CityNotFoundError` (unchanged) |

## Testing

- **`caching-weather-provider.spec.ts`** — fake `Cache` (Map-backed) + fake
  `WeatherProvider`: cache miss calls inner and stores; second call served from cache with
  no second upstream hit; asserts keys and TTLs passed to `set`.
- **`open-meteo.client.spec.ts`** (extend) — injected `fetchFn`: fails then succeeds
  within `maxRetries`; 4xx not retried; 5xx retried; timeout path aborts and surfaces
  `UpstreamError`. Use fake timers or an abort-aware `fetchFn` for the timeout case.
- **`redis-cache.spec.ts`** — stub client: get/set round-trip serialization; a throwing
  client is swallowed (get→`undefined`, set→resolves) and logs a warning.
- **`noop-cache.spec.ts`** — `get`→`undefined`, `set`→resolves; contract sanity.
- Existing **`resolvers.spec.ts`** unchanged.

## Rollout / ordering

1. Domain: `Cache` port, `NoopCache`, `CachingWeatherProvider` (+ exports, tests).
2. Client: timeout + retry (+ tests).
3. App: `RedisCache`, `composition.ts`, `main.ts`, `config.ts` (+ tests, remove `context.ts`).
4. Infra/docs: `docker-compose.yml`, `redis` dependency, README note.
