# Redis Caching, Upstream Resilience & Singleton Composition — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cache Open-Meteo calls in Redis, make the upstream fetch resilient (timeout + bounded retry), and build long-lived dependencies once at startup — without adding infrastructure imports to the domain lib.

**Architecture:** The domain lib defines a `Cache` port and a `CachingWeatherProvider` decorator (both pure). The app provides a best-effort `RedisCache` adapter and a composition root that wires everything once at startup. `OpenMeteoClient` gains an `AbortController` timeout and a retry loop. `WeatherRankingService` and the GraphQL layer are unchanged.

**Tech Stack:** TypeScript (strict, ESM), Nx 23, Vitest 4, Apollo Server 5, `redis` (node-redis), Redis 7 via docker-compose.

## Global Constraints

- TypeScript **strict**; `noPropertyAccessFromIndexSignature` is on — read env with bracket notation (`process.env['REDIS_URL']`).
- ESM only (`"type": "module"`); use `.js`-less relative imports as the existing code does (e.g. `'./config'`, `'../domain/errors'`).
- Domain lib (`weather-domain`) must NOT import any infrastructure/Redis code. The Redis adapter lives in `weather-bff` only.
- Respect Nx module boundaries — cross-project imports go through the `@collinson/weather-domain` barrel (`libs/weather-domain/src/index.ts`), not deep paths.
- Supply-chain guardrail: `pnpm-workspace.yaml` `minimumReleaseAge: 20160`. `redis` is long-stable, so no `minimumReleaseAgeExclude` entry is needed.
- Run unit tests single-shot with `pnpm exec nx test-ci <project>` (default `test` target is watch mode). Filter a file with `-- <path>` / a name with `-- -t "<substr>"`.
- Spec files live beside source in `weather-domain` (e.g. `foo.spec.ts` next to `foo.ts`); `weather-bff` unit tests live in `apps/weather-bff/tests/`.
- Do NOT commit until the user has approved (standing rule). Each task's final "Commit" step is staged and ready but only run once the user green-lights committing.

**Reference spec:** `docs/superpowers/specs/2026-07-07-caching-resilience-composition-design.md`

---

### Task 1: `Cache` port + `NoopCache` (domain)

**Files:**
- Create: `libs/weather-domain/src/cache/cache.port.ts`
- Create: `libs/weather-domain/src/cache/noop-cache.ts`
- Create: `libs/weather-domain/src/cache/noop-cache.spec.ts`
- Modify: `libs/weather-domain/src/index.ts`

**Interfaces:**
- Produces: `interface Cache { get<T>(key: string): Promise<T | undefined>; set<T>(key: string, value: T, ttlSeconds: number): Promise<void>; }` and `class NoopCache implements Cache`. Both re-exported from `@collinson/weather-domain`.

- [ ] **Step 1: Write the failing test**

`libs/weather-domain/src/cache/noop-cache.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { NoopCache } from './noop-cache';

describe('NoopCache', () => {
  it('get always resolves undefined', async () => {
    const cache = new NoopCache();
    await cache.set('k', { a: 1 }, 60);
    expect(await cache.get('k')).toBeUndefined();
  });

  it('set resolves without throwing', async () => {
    const cache = new NoopCache();
    await expect(cache.set('k', 'v', 60)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec nx test-ci weather-domain -- src/cache/noop-cache.spec.ts`
Expected: FAIL — cannot find module `./noop-cache`.

- [ ] **Step 3: Write the port and implementation**

`libs/weather-domain/src/cache/cache.port.ts`:

```ts
/** JSON-serializable key/value cache with per-entry TTL. */
export interface Cache {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
}
```

`libs/weather-domain/src/cache/noop-cache.ts`:

```ts
import type { Cache } from './cache.port';

/** Cache implementation that stores nothing — used when caching is disabled. */
export class NoopCache implements Cache {
  async get<T>(): Promise<T | undefined> {
    return undefined;
  }

  async set<T>(): Promise<void> {
    // intentionally does nothing
  }
}
```

- [ ] **Step 4: Export from the barrel**

Add to `libs/weather-domain/src/index.ts`:

```ts
export type { Cache } from './cache/cache.port';
export { NoopCache } from './cache/noop-cache';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec nx test-ci weather-domain -- src/cache/noop-cache.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add libs/weather-domain/src/cache libs/weather-domain/src/index.ts
git commit -m "feat(weather-domain): add Cache port and NoopCache"
```

---

### Task 2: `CachingWeatherProvider` decorator (domain)

**Files:**
- Create: `libs/weather-domain/src/service/caching-weather-provider.ts`
- Create: `libs/weather-domain/src/service/caching-weather-provider.spec.ts`
- Modify: `libs/weather-domain/src/index.ts`

**Interfaces:**
- Consumes: `Cache` (Task 1); `WeatherProvider { geocode(city: string): Promise<Location>; fetchForecast(location: Location): Promise<Forecast>; }` from `../service/weather-ranking.service`; `Location`, `Forecast` from `../domain/weather.types`.
- Produces: `interface CacheTtls { geocodeSeconds: number; forecastSeconds: number; }` and `class CachingWeatherProvider implements WeatherProvider` with constructor `(inner: WeatherProvider, cache: Cache, ttls: CacheTtls)`. Cache keys: `geocode:<city.trim().toLowerCase()>` and `forecast:<lat.toFixed(2)>:<lon.toFixed(2)>`. Both re-exported from the barrel.

- [ ] **Step 1: Write the failing test**

`libs/weather-domain/src/service/caching-weather-provider.spec.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import type { Cache } from '../cache/cache.port';
import type { Location, Forecast } from '../domain/weather.types';
import type { WeatherProvider } from './weather-ranking.service';
import { CachingWeatherProvider } from './caching-weather-provider';

const location: Location = {
  name: 'Lisbon', country: 'Portugal', latitude: 38.716, longitude: -9.139, timezone: 'Europe/Lisbon',
};
const forecast: Forecast = { location, days: [] };

function mapCache(): Cache {
  const store = new Map<string, unknown>();
  return {
    get: async <T>(k: string) => store.get(k) as T | undefined,
    set: async <T>(k: string, v: T) => { store.set(k, v); },
  };
}

describe('CachingWeatherProvider', () => {
  it('geocode: miss calls inner and stores under normalized key with geocode TTL', async () => {
    const cache = mapCache();
    const setSpy = vi.spyOn(cache, 'set');
    const inner: WeatherProvider = {
      geocode: vi.fn(async () => location),
      fetchForecast: vi.fn(async () => forecast),
    };
    const provider = new CachingWeatherProvider(inner, cache, { geocodeSeconds: 100, forecastSeconds: 10 });

    const result = await provider.geocode('  Lisbon ');

    expect(result).toEqual(location);
    expect(inner.geocode).toHaveBeenCalledTimes(1);
    expect(setSpy).toHaveBeenCalledWith('geocode:lisbon', location, 100);
  });

  it('geocode: second call is served from cache without hitting inner', async () => {
    const cache = mapCache();
    const inner: WeatherProvider = {
      geocode: vi.fn(async () => location),
      fetchForecast: vi.fn(async () => forecast),
    };
    const provider = new CachingWeatherProvider(inner, cache, { geocodeSeconds: 100, forecastSeconds: 10 });

    await provider.geocode('Lisbon');
    await provider.geocode('Lisbon');

    expect(inner.geocode).toHaveBeenCalledTimes(1);
  });

  it('fetchForecast: miss stores under rounded lat/lon key with forecast TTL', async () => {
    const cache = mapCache();
    const setSpy = vi.spyOn(cache, 'set');
    const inner: WeatherProvider = {
      geocode: vi.fn(async () => location),
      fetchForecast: vi.fn(async () => forecast),
    };
    const provider = new CachingWeatherProvider(inner, cache, { geocodeSeconds: 100, forecastSeconds: 10 });

    await provider.fetchForecast(location);
    const second = await provider.fetchForecast(location);

    expect(second).toEqual(forecast);
    expect(inner.fetchForecast).toHaveBeenCalledTimes(1);
    expect(setSpy).toHaveBeenCalledWith('forecast:38.72:-9.14', forecast, 10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec nx test-ci weather-domain -- src/service/caching-weather-provider.spec.ts`
Expected: FAIL — cannot find module `./caching-weather-provider`.

- [ ] **Step 3: Write the implementation**

`libs/weather-domain/src/service/caching-weather-provider.ts`:

```ts
import type { Cache } from '../cache/cache.port';
import type { Location, Forecast } from '../domain/weather.types';
import type { WeatherProvider } from './weather-ranking.service';

export interface CacheTtls {
  geocodeSeconds: number;
  forecastSeconds: number;
}

/** Decorates a WeatherProvider, caching geocode and forecast results per call. */
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

- [ ] **Step 4: Export from the barrel**

Add to `libs/weather-domain/src/index.ts`:

```ts
export {
  CachingWeatherProvider,
  type CacheTtls,
} from './service/caching-weather-provider';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec nx test-ci weather-domain -- src/service/caching-weather-provider.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add libs/weather-domain/src/service/caching-weather-provider.ts \
        libs/weather-domain/src/service/caching-weather-provider.spec.ts \
        libs/weather-domain/src/index.ts
git commit -m "feat(weather-domain): add CachingWeatherProvider decorator"
```

---

### Task 3: Upstream timeout + bounded retry (`OpenMeteoClient`)

**Files:**
- Modify: `libs/weather-domain/src/integration/open-meteo.client.ts`
- Modify: `libs/weather-domain/src/integration/open-meteo.client.spec.ts`

**Interfaces:**
- Consumes: existing `OpenMeteoClient`, `UpstreamError`, `CityNotFoundError`.
- Produces: `OpenMeteoClientOptions` extended with `timeoutMs?: number` (default 5000), `maxRetries?: number` (default 2), `retryBaseDelayMs?: number` (default 200). Retry classification: retry on abort/timeout, fetch rejection, and HTTP 5xx; throw immediately on HTTP 4xx.

- [ ] **Step 1: Write the failing tests**

Append to `libs/weather-domain/src/integration/open-meteo.client.spec.ts` (inside the existing top-level `describe`, or a new one). Import `vi` if not already imported.

```ts
describe('OpenMeteoClient resilience', () => {
  const geoResponse = {
    ok: true,
    status: 200,
    json: async () => ({ results: [{ name: 'Lisbon', latitude: 38.7, longitude: -9.1, timezone: 'Europe/Lisbon' }] }),
  } as unknown as Response;

  it('retries on a 5xx then succeeds', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValueOnce(geoResponse);
    const client = new OpenMeteoClient({ fetchFn, maxRetries: 2, retryBaseDelayMs: 1 });

    const location = await client.geocode('Lisbon');

    expect(location.name).toBe('Lisbon');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('does not retry on a 4xx and throws UpstreamError', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 400 } as Response);
    const client = new OpenMeteoClient({ fetchFn, maxRetries: 2, retryBaseDelayMs: 1 });

    await expect(client.geocode('Lisbon')).rejects.toThrow(UpstreamError);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('retries on a fetch rejection then throws after exhausting retries', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('network down'));
    const client = new OpenMeteoClient({ fetchFn, maxRetries: 1, retryBaseDelayMs: 1 });

    await expect(client.geocode('Lisbon')).rejects.toThrow(UpstreamError);
    expect(fetchFn).toHaveBeenCalledTimes(2); // initial + 1 retry
  });

  it('aborts a hanging request after timeoutMs and surfaces UpstreamError', async () => {
    const fetchFn = vi.fn((_url: URL, init?: { signal?: AbortSignal }) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      }),
    );
    const client = new OpenMeteoClient({ fetchFn, timeoutMs: 5, maxRetries: 0, retryBaseDelayMs: 1 });

    await expect(client.geocode('Lisbon')).rejects.toThrow(UpstreamError);
  });
});
```

Confirm the existing spec imports include `UpstreamError` and `vi`; add them to the import from `vitest` / `../domain/errors` if missing.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec nx test-ci weather-domain -- src/integration/open-meteo.client.spec.ts`
Expected: FAIL — no retry/timeout behavior yet (e.g. 5xx test calls fetch once, 4xx isn't distinguished, timeout hangs or wrong error).

- [ ] **Step 3: Add options and helpers**

In `open-meteo.client.ts`, extend the options interface:

```ts
export interface OpenMeteoClientOptions {
  fetchFn?: FetchFn;
  geocodingBaseUrl?: string;
  forecastBaseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
}
```

Add module-level helpers above the class:

```ts
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BASE_DELAY_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

Add private fields and assign them in the constructor:

```ts
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
```

```ts
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
```

- [ ] **Step 4: Rewrite `getJson` with timeout + retry**

Replace the existing `getJson` method body with:

```ts
  private async getJson<T>(url: URL): Promise<T> {
    let lastError = 'unknown error';

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        await sleep(this.retryBaseDelayMs * 2 ** (attempt - 1));
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchFn(url, { signal: controller.signal });
        if (response.ok) {
          return (await response.json()) as T;
        }
        // 4xx: caller error — do not retry.
        if (response.status < 500) {
          throw new UpstreamError(`Open-Meteo responded with status ${response.status}`);
        }
        // 5xx: retryable.
        lastError = `status ${response.status}`;
      } catch (cause) {
        if (cause instanceof UpstreamError) throw cause; // non-retryable 4xx
        lastError = String(cause);
      } finally {
        clearTimeout(timer);
      }
    }

    throw new UpstreamError(`Open-Meteo request failed after retries: ${lastError}`);
  }
```

Note: `FetchFn` is `typeof globalThis.fetch`, so passing `{ signal }` as the second arg is already type-compatible.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm exec nx test-ci weather-domain -- src/integration/open-meteo.client.spec.ts`
Expected: PASS — including the original geocode/forecast tests and the 4 new resilience tests.

- [ ] **Step 6: Commit**

```bash
git add libs/weather-domain/src/integration/open-meteo.client.ts \
        libs/weather-domain/src/integration/open-meteo.client.spec.ts
git commit -m "feat(weather-domain): add timeout and bounded retry to OpenMeteoClient"
```

---

### Task 4: `RedisCache` adapter (app, best-effort)

**Files:**
- Create: `apps/weather-bff/src/cache/redis-cache.ts`
- Create: `apps/weather-bff/tests/redis-cache.spec.ts`
- Modify: `apps/weather-bff/package.json` (add `redis` dependency)

**Interfaces:**
- Consumes: `Cache` from `@collinson/weather-domain`.
- Produces: `class RedisCache implements Cache` with constructor `(client: RedisLike, logger?: Pick<Console, 'warn'>)`, where `RedisLike` is the minimal slice of the node-redis client it uses: `{ get(key: string): Promise<string | null>; set(key: string, value: string, opts: { EX: number }): Promise<unknown>; }`. Best-effort: swallow errors, `get` returns `undefined` on failure.

- [ ] **Step 1: Add the `redis` dependency**

```bash
pnpm --filter @collinson/weather-bff add redis
```

Expected: `redis` appears under `dependencies` in `apps/weather-bff/package.json`; install succeeds (no `minimumReleaseAge` rejection, since `redis` is long-stable).

- [ ] **Step 2: Write the failing test**

`apps/weather-bff/tests/redis-cache.spec.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { RedisCache } from '../src/cache/redis-cache';

describe('RedisCache', () => {
  it('set serializes value with EX ttl; get deserializes', async () => {
    const store = new Map<string, string>();
    const client = {
      get: vi.fn(async (k: string) => store.get(k) ?? null),
      set: vi.fn(async (k: string, v: string) => { store.set(k, v); return 'OK'; }),
    };
    const cache = new RedisCache(client);

    await cache.set('k', { a: 1 }, 60);
    expect(client.set).toHaveBeenCalledWith('k', JSON.stringify({ a: 1 }), { EX: 60 });
    expect(await cache.get('k')).toEqual({ a: 1 });
  });

  it('get returns undefined for a missing key', async () => {
    const client = { get: vi.fn(async () => null), set: vi.fn(async () => 'OK') };
    const cache = new RedisCache(client);
    expect(await cache.get('missing')).toBeUndefined();
  });

  it('get swallows client errors (best-effort) and warns', async () => {
    const warn = vi.fn();
    const client = {
      get: vi.fn(async () => { throw new Error('conn refused'); }),
      set: vi.fn(async () => 'OK'),
    };
    const cache = new RedisCache(client, { warn });
    expect(await cache.get('k')).toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
  });

  it('set swallows client errors (best-effort) and warns', async () => {
    const warn = vi.fn();
    const client = {
      get: vi.fn(async () => null),
      set: vi.fn(async () => { throw new Error('conn refused'); }),
    };
    const cache = new RedisCache(client, { warn });
    await expect(cache.set('k', 'v', 60)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm exec nx test-ci weather-bff -- tests/redis-cache.spec.ts`
Expected: FAIL — cannot find module `../src/cache/redis-cache`.

- [ ] **Step 4: Write the implementation**

`apps/weather-bff/src/cache/redis-cache.ts`:

```ts
import type { Cache } from '@collinson/weather-domain';

/** Minimal slice of the node-redis client used by RedisCache. */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, opts: { EX: number }): Promise<unknown>;
}

/**
 * Best-effort Redis-backed Cache. On any Redis error it logs a warning and
 * degrades to a miss so the request falls through to upstream.
 */
export class RedisCache implements Cache {
  constructor(
    private readonly client: RedisLike,
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

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec nx test-ci weather-bff -- tests/redis-cache.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/weather-bff/src/cache/redis-cache.ts \
        apps/weather-bff/tests/redis-cache.spec.ts \
        apps/weather-bff/package.json pnpm-lock.yaml
git commit -m "feat(weather-bff): add best-effort RedisCache adapter"
```

---

### Task 5: Config additions

**Files:**
- Modify: `apps/weather-bff/src/config.ts`

**Interfaces:**
- Produces: `config` gains `redisUrl: string | undefined`, `geocodeTtlSeconds: number`, `forecastTtlSeconds: number`, `upstreamTimeoutMs: number`, `upstreamMaxRetries: number`. Also export `type Config = typeof config;` for the composition root.

- [ ] **Step 1: Extend config**

Replace the contents of `apps/weather-bff/src/config.ts` with:

```ts
export const config = {
  port: Number(process.env['PORT'] ?? 4000),
  geocodingBaseUrl:
    process.env['OPEN_METEO_GEOCODING_URL'] ?? 'https://geocoding-api.open-meteo.com/v1/search',
  forecastBaseUrl:
    process.env['OPEN_METEO_FORECAST_URL'] ?? 'https://api.open-meteo.com/v1/forecast',
  redisUrl: process.env['REDIS_URL'],
  geocodeTtlSeconds: Number(process.env['GEOCODE_TTL_SECONDS'] ?? 2_592_000), // 30 days
  forecastTtlSeconds: Number(process.env['FORECAST_TTL_SECONDS'] ?? 3600), // 1 hour
  upstreamTimeoutMs: Number(process.env['UPSTREAM_TIMEOUT_MS'] ?? 5000),
  upstreamMaxRetries: Number(process.env['UPSTREAM_MAX_RETRIES'] ?? 2),
};

export type Config = typeof config;
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec nx typecheck weather-bff`
Expected: PASS (no type errors).

- [ ] **Step 3: Commit**

```bash
git add apps/weather-bff/src/config.ts
git commit -m "feat(weather-bff): add cache and upstream-resilience config"
```

---

### Task 6: Composition root + wire `main.ts`

**Files:**
- Create: `apps/weather-bff/src/composition.ts`
- Modify: `apps/weather-bff/src/main.ts`
- Delete: `apps/weather-bff/src/context.ts`
- Create: `apps/weather-bff/tests/composition.spec.ts`

**Interfaces:**
- Consumes: `Config` (Task 5); `OpenMeteoClient`, `CachingWeatherProvider`, `WeatherRankingService`, `NoopCache`, `Cache` from `@collinson/weather-domain`; `RedisCache` (Task 4); `createClient` from `redis`.
- Produces: `interface Services { service: WeatherRankingService; shutdown: () => Promise<void>; }` and `async function composeServices(config: Config): Promise<Services>`. `GraphQLContext` (in `resolvers.ts`) is unchanged: `{ service }`.

- [ ] **Step 1: Write the failing test**

The composition root must build a working service and a `shutdown`. Test the no-Redis path (NoopCache) so no live Redis is needed.

`apps/weather-bff/tests/composition.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { composeServices } from '../src/composition';
import type { Config } from '../src/config';

const baseConfig: Config = {
  port: 4000,
  geocodingBaseUrl: 'http://localhost/geo',
  forecastBaseUrl: 'http://localhost/forecast',
  redisUrl: undefined,
  geocodeTtlSeconds: 100,
  forecastTtlSeconds: 10,
  upstreamTimeoutMs: 5000,
  upstreamMaxRetries: 2,
};

describe('composeServices', () => {
  it('builds a service and a shutdown hook when Redis is disabled', async () => {
    const services = await composeServices(baseConfig);
    expect(typeof services.service.rankForCity).toBe('function');
    await expect(services.shutdown()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec nx test-ci weather-bff -- tests/composition.spec.ts`
Expected: FAIL — cannot find module `../src/composition`.

- [ ] **Step 3: Write the composition root**

`apps/weather-bff/src/composition.ts`:

```ts
import { createClient } from 'redis';
import {
  OpenMeteoClient,
  CachingWeatherProvider,
  WeatherRankingService,
  NoopCache,
  type Cache,
} from '@collinson/weather-domain';
import { RedisCache } from './cache/redis-cache';
import type { Config } from './config';

export interface Services {
  service: WeatherRankingService;
  shutdown: () => Promise<void>;
}

/** Composition root: builds long-lived dependencies once at startup. */
export async function composeServices(config: Config): Promise<Services> {
  let cache: Cache = new NoopCache();
  let shutdown = async (): Promise<void> => {};

  if (config.redisUrl) {
    const client = createClient({ url: config.redisUrl });
    client.on('error', (err) => console.warn(`Redis client error: ${String(err)}`));
    await client.connect();
    cache = new RedisCache(client);
    shutdown = async () => {
      await client.quit();
    };
  }

  const client = new OpenMeteoClient({
    geocodingBaseUrl: config.geocodingBaseUrl,
    forecastBaseUrl: config.forecastBaseUrl,
    timeoutMs: config.upstreamTimeoutMs,
    maxRetries: config.upstreamMaxRetries,
  });
  const provider = new CachingWeatherProvider(client, cache, {
    geocodeSeconds: config.geocodeTtlSeconds,
    forecastSeconds: config.forecastTtlSeconds,
  });
  const service = new WeatherRankingService(provider);

  return { service, shutdown };
}
```

- [ ] **Step 4: Rewrite `main.ts` to compose once and handle shutdown**

Replace `apps/weather-bff/src/main.ts` with:

```ts
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { typeDefs } from './graphql/schema';
import { resolvers, type GraphQLContext } from './graphql/resolvers';
import { composeServices } from './composition';
import { config } from './config';

async function main(): Promise<void> {
  const { service, shutdown } = await composeServices(config);
  const server = new ApolloServer<GraphQLContext>({ typeDefs, resolvers });
  const { url } = await startStandaloneServer(server, {
    context: async () => ({ service }),
    listen: { port: config.port },
  });
  console.log(`weather-bff ready at ${url}`);

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      void shutdown().finally(() => process.exit(0));
    });
  }
}

main().catch((error) => {
  console.error('Failed to start weather-bff', error);
  process.exit(1);
});
```

- [ ] **Step 5: Delete the obsolete per-request context builder**

```bash
git rm apps/weather-bff/src/context.ts
```

`GraphQLContext` is defined in `resolvers.ts`, so nothing else imports `context.ts`. Confirm with:

Run: `grep -rn "context'" apps/weather-bff/src || echo "no references"`
Expected: no import of `./context` remains (only `./graphql/resolvers` provides the type).

- [ ] **Step 6: Run tests + typecheck**

Run: `pnpm exec nx test-ci weather-bff -- tests/composition.spec.ts`
Expected: PASS (1 test).

Run: `pnpm exec nx typecheck weather-bff`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/weather-bff/src/composition.ts apps/weather-bff/src/main.ts \
        apps/weather-bff/tests/composition.spec.ts
git rm apps/weather-bff/src/context.ts
git commit -m "feat(weather-bff): compose singleton deps once at startup with graceful shutdown"
```

---

### Task 7: Infra + docs (docker-compose, README)

**Files:**
- Create: `docker-compose.yml`
- Modify: `apps/weather-bff/README.md`

**Interfaces:**
- Produces: a Redis 7 service for local dev; documentation of the new env vars and startup flow.

- [ ] **Step 1: Add docker-compose**

`docker-compose.yml` at repo root:

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
```

- [ ] **Step 2: Verify it starts**

Run: `docker compose up -d redis && docker compose ps`
Expected: the `redis` service is listed as running/healthy.

(Then optionally `docker compose down` to stop it.)

- [ ] **Step 3: Document in the weather-bff README**

Append a "Caching & resilience" section to `apps/weather-bff/README.md` describing:

```markdown
## Caching & resilience

Open-Meteo calls are cached per upstream request (geocoding + forecast) through a
`Cache` port. In production the port is backed by Redis; caching is **best-effort**,
so if Redis is unreachable the request degrades to a live upstream call.

Start Redis for local dev:

```sh
docker compose up -d redis
export REDIS_URL=redis://localhost:6379
pnpm exec nx dev weather-bff
```

If `REDIS_URL` is unset, caching is disabled (a no-op cache is used) and the app runs
without Redis.

### Environment variables

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | HTTP port |
| `REDIS_URL` | *(unset)* | Redis connection; unset disables caching |
| `GEOCODE_TTL_SECONDS` | `2592000` | Geocode cache TTL (30 days) |
| `FORECAST_TTL_SECONDS` | `3600` | Forecast cache TTL (1 hour) |
| `UPSTREAM_TIMEOUT_MS` | `5000` | Per-attempt Open-Meteo fetch timeout |
| `UPSTREAM_MAX_RETRIES` | `2` | Retries after the first attempt (5xx/timeout/network) |
```

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml apps/weather-bff/README.md
git commit -m "docs(weather-bff): add Redis compose and caching/resilience docs"
```

---

### Task 8: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test/lint/typecheck sweep**

Run: `pnpm exec nx run-many -t test-ci lint typecheck -p weather-bff weather-domain`
Expected: all targets PASS. In particular, the pre-existing `apps/weather-bff/tests/resolvers.spec.ts` still passes unchanged (context remains `{ service }`).

- [ ] **Step 2: Smoke-test the running server (optional, with Redis up)**

```sh
docker compose up -d redis
export REDIS_URL=redis://localhost:6379
pnpm exec nx dev weather-bff
```

In another shell, POST a `rankActivities` query and confirm a result returns; run it twice and confirm the second is served faster (cache hit). Then `docker compose down`.

- [ ] **Step 3: Final commit (if any verification fixups were needed)**

```bash
git add -A
git commit -m "test: verify caching/resilience/composition end to end"
```

---

## Notes for the implementer

- **TDD throughout:** every code task writes the failing test first, watches it fail, then implements.
- **Domain purity:** Tasks 1–3 add nothing outside `weather-domain` that imports infrastructure. `redis` is only imported in `apps/weather-bff` (Tasks 4, 6).
- **Backwards compatibility:** `GraphQLContext` stays `{ service }`; `WeatherRankingService` and the GraphQL schema/resolvers are untouched, so `resolvers.spec.ts` needs no changes.
- **Commit discipline:** commit steps are prepared but, per the standing rule, only run once the user approves committing.
