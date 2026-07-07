# Weather BFF (GraphQL) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Node + GraphQL backend-for-frontend (`weather-bff`) that, given a city name, ranks four activities (skiing, surfing, outdoor/indoor sightseeing) over the next 7 days using Open-Meteo, exposing per-day and overall scores.

**Architecture:** A thin Apollo Server (standalone, SDL-first) app in `apps/weather-bff` delegates to a pure, framework-agnostic library `libs/weather-domain`. The lib holds an injected Open-Meteo client (geocoding + forecast), a per-activity scoring strategy set, and a pure ranking function. The client is dependency-injected so all domain logic is unit-tested without network access.

**Tech Stack:** TypeScript (strict), Nx 23 (TS-solution monorepo, pnpm workspaces), Apollo Server 4 (`@apollo/server`), `graphql`, Vitest 4, `tsx` (dev runtime). Node 20+ global `fetch`.

## Global Constraints

- **Package names:** workspace scope is `@collinson`. The lib is `@collinson/weather-domain`; the app is `@collinson/weather-bff`. Consumers import the lib by package name (resolved to `src` via the `@collinson/source` custom condition in `tsconfig.base.json`).
- **Generate libs with Nx** so targets are inferred (per CLAUDE.md). No `project.json` for lib; the app uses one `project.json` only for its `serve`/`start` targets (`nx:run-commands`), relying on inferred `lint`/`test`/`typecheck`.
- **Supply-chain cooldown:** `pnpm-workspace.yaml` sets `minimumReleaseAge: 20160` (2 weeks). All new runtime deps (`@apollo/server`, `graphql`, `tsx`) are years old and install without exclusion. Do **not** add packages published < 2 weeks ago; if forced, add them to `minimumReleaseAgeExclude`.
- **No new `@nx/*` plugins** are required — `@nx/js`, `@nx/vite`, `@nx/vitest`, `@nx/eslint` are already installed.
- **TypeScript base** (`tsconfig.base.json`) is `strict`, `module: esnext`, `moduleResolution: bundler`, `emitDeclarationOnly: true` — so the app runs via `tsx`, not a tsc-emitted bundle (documented trade-off).
- **Open-Meteo endpoints** (verified 2026-07-07):
  - Geocoding: `https://geocoding-api.open-meteo.com/v1/search?name=<city>&count=1` → `results[0]`; `results` key absent when no match.
  - Forecast: `https://api.open-meteo.com/v1/forecast` with `daily=temperature_2m_max,temperature_2m_min,rain_sum,snowfall_sum,wind_speed_10m_max,wind_direction_10m_dominant,wind_gusts_10m_max,weather_code,precipitation_probability_max`, `timeformat=unixtime`, `format=json`, `timezone=auto`. `daily` is **columnar** (parallel arrays, 7 entries); response includes `utc_offset_seconds`.
- **Scores** are integers 0–100. `overallScore` = rounded mean of the 7 daily scores. Rankings sorted by `overallScore` descending.
- **Branch:** work on `feat/weather-bff-graphql` (already checked out). Commit after every task.

---

## File Structure

```
libs/weather-domain/
  src/
    index.ts                              # public API barrel
    domain/
      weather.types.ts                    # DailyWeather, Location, Forecast, Activity, DailyScore, ActivityRanking, CityRanking
      errors.ts                           # CityNotFoundError, UpstreamError, InvalidInputError
      scoring/
        score-utils.ts                    # clampScore()
        activity-scorer.ts                # ActivityScorer interface
        skiing.scorer.ts
        surfing.scorer.ts
        outdoor-sightseeing.scorer.ts
        indoor-sightseeing.scorer.ts
        registry.ts                       # scorers[] in stable order
      rank-activities.ts                  # pure: Forecast -> CityRanking
    integration/
      open-meteo.client.ts                # geocode() + fetchForecast()
    service/
      weather-ranking.service.ts          # WeatherRankingService (client injected)

apps/weather-bff/
  project.json                            # serve/start targets (nx:run-commands + tsx)
  package.json                            # @collinson/weather-bff, apollo/graphql deps
  tsconfig.json / tsconfig.app.json / tsconfig.spec.json
  vite.config.mts                         # Vitest config (node env)
  eslint.config.mjs
  src/
    main.ts                               # startStandaloneServer
    config.ts                             # port + base URLs from env
    context.ts                            # builds { service }
    graphql/
      schema.ts                           # SDL typeDefs
      resolvers.ts                        # Query.rankActivities -> service
  tests/
    resolvers.spec.ts                     # end-to-end query against ApolloServer w/ stub service
```

---

## Task 1: Scaffold the `weather-domain` library

**Files:**
- Create (via generator): `libs/weather-domain/**` (package.json, tsconfig*, vite.config, eslint.config, sample src)
- Modify: root `tsconfig.json` (references — generator handles), root `package.json` `workspaces` (ensure `libs/*`)

**Interfaces:**
- Produces: an Nx project named `weather-domain`, importable as `@collinson/weather-domain`, with inferred `test`/`test-ci`/`lint`/`typecheck`/`build` targets.

- [ ] **Step 1: Generate the library**

```bash
pnpm exec nx g @nx/js:lib weather-domain \
  --directory=libs/weather-domain \
  --unitTestRunner=vitest \
  --bundler=tsc \
  --linter=eslint \
  --no-interactive
```

- [ ] **Step 2: Verify the project and its package name**

```bash
pnpm exec nx show project weather-domain --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const p=JSON.parse(s);console.log('targets:',Object.keys(p.targets));})"
node -e "console.log(require('./libs/weather-domain/package.json').name)"
```
Expected: targets include `test`, `lint`, `typecheck`; package name prints `@collinson/weather-domain`.

- [ ] **Step 3: Ensure `libs/*` is a workspace member**

Open root `package.json`. If the `workspaces` array does not already include `"libs/*"`, add it so it reads:
```json
"workspaces": [
  "apps/*",
  "libs/*"
]
```
Then reinstall so the new package is linked:
```bash
pnpm install
```

- [ ] **Step 4: Remove generator sample files**

The generator creates a sample module + test. Delete them (our structure replaces them):
```bash
rm -f libs/weather-domain/src/lib/*.ts libs/weather-domain/src/lib/*.spec.ts
rmdir libs/weather-domain/src/lib 2>/dev/null || true
```
Replace `libs/weather-domain/src/index.ts` with an empty placeholder for now:
```ts
export {};
```

- [ ] **Step 5: Add `node` types to the lib tsconfigs**

The client uses global `fetch` and the tests run under Node. In `libs/weather-domain/tsconfig.lib.json` and `libs/weather-domain/tsconfig.spec.json`, ensure `compilerOptions.types` includes `"node"`:
```jsonc
// tsconfig.lib.json compilerOptions
"types": ["node"]
```
```jsonc
// tsconfig.spec.json compilerOptions
"types": ["node", "vitest/globals"]
```

- [ ] **Step 6: Verify the empty lib builds/lints**

Run: `pnpm exec nx typecheck weather-domain && pnpm exec nx lint weather-domain`
Expected: both PASS (no source yet beyond the empty barrel).

- [ ] **Step 7: Commit**

```bash
git add libs/weather-domain package.json pnpm-lock.yaml tsconfig.json
git commit -m "feat(weather-domain): scaffold domain library"
```

---

## Task 2: Domain types, errors, and score utility

**Files:**
- Create: `libs/weather-domain/src/domain/weather.types.ts`
- Create: `libs/weather-domain/src/domain/errors.ts`
- Create: `libs/weather-domain/src/domain/scoring/score-utils.ts`
- Create: `libs/weather-domain/src/domain/scoring/activity-scorer.ts`
- Test: `libs/weather-domain/src/domain/scoring/score-utils.spec.ts`

**Interfaces:**
- Produces:
  - Types `Activity`, `DailyWeather`, `Location`, `Forecast`, `DailyScore`, `ActivityRanking`, `CityRanking`.
  - Errors `CityNotFoundError`, `UpstreamError`, `InvalidInputError` (each with `.code`).
  - `clampScore(n: number): number` → integer clamped to `[0,100]`.
  - `interface ActivityScorer { activity: Activity; scoreDay(day: DailyWeather): number }`.

- [ ] **Step 1: Write the failing test for `clampScore`**

`libs/weather-domain/src/domain/scoring/score-utils.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { clampScore } from './score-utils';

describe('clampScore', () => {
  it('rounds to an integer', () => {
    expect(clampScore(72.4)).toBe(72);
    expect(clampScore(72.6)).toBe(73);
  });
  it('clamps below 0 to 0 and above 100 to 100', () => {
    expect(clampScore(-5)).toBe(0);
    expect(clampScore(150)).toBe(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec nx test weather-domain -- score-utils`
Expected: FAIL — cannot resolve `./score-utils`.

- [ ] **Step 3: Write the domain types**

`libs/weather-domain/src/domain/weather.types.ts`:
```ts
export type Activity =
  | 'SKIING'
  | 'SURFING'
  | 'OUTDOOR_SIGHTSEEING'
  | 'INDOOR_SIGHTSEEING';

export interface DailyWeather {
  date: string; // ISO YYYY-MM-DD (local calendar day)
  weatherCode: number;
  tempMaxC: number;
  tempMinC: number;
  rainMm: number;
  snowfallCm: number;
  windSpeedMax: number;
  windGustsMax: number;
  windDirectionDominant: number;
  precipitationProbabilityMax: number;
}

export interface Location {
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface Forecast {
  location: Location;
  days: DailyWeather[];
}

export interface DailyScore {
  date: string;
  score: number; // 0..100
  weather: DailyWeather;
}

export interface ActivityRanking {
  activity: Activity;
  overallScore: number; // 0..100
  daily: DailyScore[];
}

export interface CityRanking {
  location: Location;
  rankings: ActivityRanking[]; // sorted best -> worst
}
```

- [ ] **Step 4: Write the error classes**

`libs/weather-domain/src/domain/errors.ts`:
```ts
export class InvalidInputError extends Error {
  readonly code = 'BAD_USER_INPUT';
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInputError';
  }
}

export class CityNotFoundError extends Error {
  readonly code = 'CITY_NOT_FOUND';
  constructor(city: string) {
    super(`No location found for "${city}".`);
    this.name = 'CityNotFoundError';
  }
}

export class UpstreamError extends Error {
  readonly code = 'UPSTREAM_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'UpstreamError';
  }
}
```

- [ ] **Step 5: Write the scorer interface and `clampScore`**

`libs/weather-domain/src/domain/scoring/activity-scorer.ts`:
```ts
import type { Activity, DailyWeather } from '../weather.types';

export interface ActivityScorer {
  readonly activity: Activity;
  scoreDay(day: DailyWeather): number; // 0..100 (need not be pre-clamped)
}
```

`libs/weather-domain/src/domain/scoring/score-utils.ts`:
```ts
export function clampScore(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)));
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm exec nx test weather-domain -- score-utils`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add libs/weather-domain/src/domain
git commit -m "feat(weather-domain): domain types, errors, score utils"
```

---

## Task 3: Skiing scorer

**Files:**
- Create: `libs/weather-domain/src/domain/scoring/skiing.scorer.ts`
- Test: `libs/weather-domain/src/domain/scoring/skiing.scorer.spec.ts`

**Interfaces:**
- Consumes: `ActivityScorer`, `DailyWeather`, `clampScore`.
- Produces: `export const skiingScorer: ActivityScorer` (`activity: 'SKIING'`).

Scoring: rewards snowfall (up to 60 pts at ≥5 cm) and cold (up to 40 pts at ≤0 °C max, 0 at ≥10 °C); penalizes rain (up to 30) and strong wind above 40 km/h (up to 20).

- [ ] **Step 1: Write the failing test**

`skiing.scorer.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { skiingScorer } from './skiing.scorer';
import type { DailyWeather } from '../weather.types';

const base: DailyWeather = {
  date: '2026-07-07', weatherCode: 71, tempMaxC: -3, tempMinC: -10,
  rainMm: 0, snowfallCm: 8, windSpeedMax: 10, windGustsMax: 20,
  windDirectionDominant: 180, precipitationProbabilityMax: 90,
};

describe('skiingScorer', () => {
  it('is SKIING', () => expect(skiingScorer.activity).toBe('SKIING'));

  it('scores a cold, snowy, calm day highly', () => {
    expect(skiingScorer.scoreDay(base)).toBeGreaterThanOrEqual(85);
  });

  it('scores a warm, rainy, snowless day near zero', () => {
    const warm: DailyWeather = { ...base, tempMaxC: 18, snowfallCm: 0, rainMm: 12, weatherCode: 61 };
    expect(skiingScorer.scoreDay(warm)).toBeLessThanOrEqual(5);
  });

  it('penalizes very strong wind', () => {
    const windy: DailyWeather = { ...base, windSpeedMax: 80 };
    expect(skiingScorer.scoreDay(windy)).toBeLessThan(skiingScorer.scoreDay(base));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec nx test weather-domain -- skiing.scorer`
Expected: FAIL — cannot resolve `./skiing.scorer`.

- [ ] **Step 3: Implement the scorer**

`skiing.scorer.ts`:
```ts
import type { ActivityScorer } from './activity-scorer';
import type { DailyWeather } from '../weather.types';
import { clampScore } from './score-utils';

export const skiingScorer: ActivityScorer = {
  activity: 'SKIING',
  scoreDay(day: DailyWeather): number {
    const snow = Math.min(day.snowfallCm / 5, 1) * 60;
    const cold = Math.min(Math.max((10 - day.tempMaxC) / 10, 0), 1) * 40;
    const rainPenalty = Math.min(day.rainMm / 10, 1) * 30;
    const windPenalty =
      day.windSpeedMax > 40 ? Math.min((day.windSpeedMax - 40) / 40, 1) * 20 : 0;
    return clampScore(snow + cold - rainPenalty - windPenalty);
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec nx test weather-domain -- skiing.scorer`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add libs/weather-domain/src/domain/scoring/skiing.scorer.*
git commit -m "feat(weather-domain): skiing scorer"
```

---

## Task 4: Surfing scorer

**Files:**
- Create: `libs/weather-domain/src/domain/scoring/surfing.scorer.ts`
- Test: `libs/weather-domain/src/domain/scoring/surfing.scorer.spec.ts`

**Interfaces:**
- Consumes: `ActivityScorer`, `DailyWeather`, `clampScore`.
- Produces: `export const surfingScorer: ActivityScorer` (`activity: 'SURFING'`).

Scoring: wind is the driver (peaks in the 20–35 km/h band, falls off below 5 and above 60), multiplied by a mild-temperature factor (full credit 15–30 °C max temp, reduced outside 10–35 °C). Wave data is unavailable — documented approximation.

- [ ] **Step 1: Write the failing test**

`surfing.scorer.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { surfingScorer } from './surfing.scorer';
import type { DailyWeather } from '../weather.types';

const base: DailyWeather = {
  date: '2026-07-07', weatherCode: 2, tempMaxC: 24, tempMinC: 18,
  rainMm: 0, snowfallCm: 0, windSpeedMax: 26, windGustsMax: 34,
  windDirectionDominant: 200, precipitationProbabilityMax: 10,
};

describe('surfingScorer', () => {
  it('is SURFING', () => expect(surfingScorer.activity).toBe('SURFING'));

  it('scores a mild day with good wind highly', () => {
    expect(surfingScorer.scoreDay(base)).toBeGreaterThanOrEqual(80);
  });

  it('scores a flat-calm day low', () => {
    const calm: DailyWeather = { ...base, windSpeedMax: 2, windGustsMax: 4 };
    expect(surfingScorer.scoreDay(calm)).toBeLessThanOrEqual(10);
  });

  it('reduces score on a freezing day even with good wind', () => {
    const cold: DailyWeather = { ...base, tempMaxC: 2 };
    expect(surfingScorer.scoreDay(cold)).toBeLessThan(surfingScorer.scoreDay(base));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec nx test weather-domain -- surfing.scorer`
Expected: FAIL — cannot resolve `./surfing.scorer`.

- [ ] **Step 3: Implement the scorer**

`surfing.scorer.ts`:
```ts
import type { ActivityScorer } from './activity-scorer';
import type { DailyWeather } from '../weather.types';
import { clampScore } from './score-utils';

function windScore(w: number): number {
  if (w < 5) return 0;
  if (w <= 20) return ((w - 5) / 15) * 70; // 0..70
  if (w <= 35) return 70 + ((w - 20) / 15) * 30; // 70..100
  if (w <= 60) return Math.max(100 - ((w - 35) / 25) * 100, 0); // 100..0
  return 0;
}

function tempFactor(tempMaxC: number): number {
  if (tempMaxC >= 15 && tempMaxC <= 30) return 1;
  if (tempMaxC < 10 || tempMaxC > 35) return 0.3;
  return 0.7;
}

export const surfingScorer: ActivityScorer = {
  activity: 'SURFING',
  scoreDay(day: DailyWeather): number {
    return clampScore(windScore(day.windSpeedMax) * tempFactor(day.tempMaxC));
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec nx test weather-domain -- surfing.scorer`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add libs/weather-domain/src/domain/scoring/surfing.scorer.*
git commit -m "feat(weather-domain): surfing scorer (wind-based approximation)"
```

---

## Task 5: Outdoor sightseeing scorer

**Files:**
- Create: `libs/weather-domain/src/domain/scoring/outdoor-sightseeing.scorer.ts`
- Test: `libs/weather-domain/src/domain/scoring/outdoor-sightseeing.scorer.spec.ts`

**Interfaces:**
- Consumes: `ActivityScorer`, `DailyWeather`, `clampScore`.
- Produces: `export const outdoorSightseeingScorer: ActivityScorer` (`activity: 'OUTDOOR_SIGHTSEEING'`) **and** `export function skyClearness(weatherCode: number): number` (0..100), reused by the indoor scorer.

Scoring: half weight on sky clearness (from WMO `weatherCode`), half on temperature comfort (peak at 20 °C avg), minus penalties for precipitation probability and wind.

- [ ] **Step 1: Write the failing test**

`outdoor-sightseeing.scorer.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { outdoorSightseeingScorer, skyClearness } from './outdoor-sightseeing.scorer';
import type { DailyWeather } from '../weather.types';

const nice: DailyWeather = {
  date: '2026-07-07', weatherCode: 0, tempMaxC: 23, tempMinC: 17,
  rainMm: 0, snowfallCm: 0, windSpeedMax: 8, windGustsMax: 15,
  windDirectionDominant: 200, precipitationProbabilityMax: 5,
};

describe('skyClearness', () => {
  it('rewards clear codes and punishes storms', () => {
    expect(skyClearness(0)).toBeGreaterThan(skyClearness(3));
    expect(skyClearness(95)).toBeLessThan(skyClearness(3));
  });
});

describe('outdoorSightseeingScorer', () => {
  it('is OUTDOOR_SIGHTSEEING', () =>
    expect(outdoorSightseeingScorer.activity).toBe('OUTDOOR_SIGHTSEEING'));

  it('scores a clear, mild, calm, dry day highly', () => {
    expect(outdoorSightseeingScorer.scoreDay(nice)).toBeGreaterThanOrEqual(80);
  });

  it('scores a stormy, wet day low', () => {
    const storm: DailyWeather = {
      ...nice, weatherCode: 95, rainMm: 20, precipitationProbabilityMax: 95, windSpeedMax: 45,
    };
    expect(outdoorSightseeingScorer.scoreDay(storm)).toBeLessThanOrEqual(25);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec nx test weather-domain -- outdoor-sightseeing.scorer`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement the scorer**

`outdoor-sightseeing.scorer.ts`:
```ts
import type { ActivityScorer } from './activity-scorer';
import type { DailyWeather } from '../weather.types';
import { clampScore } from './score-utils';

// WMO weather_code -> 0..100 "how clear/pleasant the sky is".
export function skyClearness(weatherCode: number): number {
  if (weatherCode === 0) return 100;
  if (weatherCode === 1) return 90;
  if (weatherCode === 2) return 70;
  if (weatherCode === 3) return 50;
  if (weatherCode === 45 || weatherCode === 48) return 30;
  if (weatherCode >= 51 && weatherCode <= 67) return 20; // drizzle/rain
  if (weatherCode >= 71 && weatherCode <= 77) return 20; // snow
  if (weatherCode >= 80 && weatherCode <= 82) return 15; // showers
  if (weatherCode >= 95) return 0; // thunderstorm
  return 25;
}

export const outdoorSightseeingScorer: ActivityScorer = {
  activity: 'OUTDOOR_SIGHTSEEING',
  scoreDay(day: DailyWeather): number {
    const avgTemp = (day.tempMaxC + day.tempMinC) / 2;
    const tempComfort = 1 - Math.min(Math.abs(avgTemp - 20) / 20, 1); // 0..1
    const precipPenalty = (day.precipitationProbabilityMax / 100) * 30;
    const windPenalty = Math.min(day.windSpeedMax / 60, 1) * 15;
    return clampScore(
      skyClearness(day.weatherCode) * 0.5 +
        tempComfort * 50 -
        precipPenalty -
        windPenalty,
    );
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec nx test weather-domain -- outdoor-sightseeing.scorer`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add libs/weather-domain/src/domain/scoring/outdoor-sightseeing.scorer.*
git commit -m "feat(weather-domain): outdoor sightseeing scorer"
```

---

## Task 6: Indoor sightseeing scorer

**Files:**
- Create: `libs/weather-domain/src/domain/scoring/indoor-sightseeing.scorer.ts`
- Test: `libs/weather-domain/src/domain/scoring/indoor-sightseeing.scorer.spec.ts`

**Interfaces:**
- Consumes: `ActivityScorer`, `DailyWeather`, `clampScore`, `outdoorSightseeingScorer`.
- Produces: `export const indoorSightseeingScorer: ActivityScorer` (`activity: 'INDOOR_SIGHTSEEING'`). It is the inverse of outdoor: `100 - outdoor.scoreDay(day)` — the bad-weather fallback.

- [ ] **Step 1: Write the failing test**

`indoor-sightseeing.scorer.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { indoorSightseeingScorer } from './indoor-sightseeing.scorer';
import { outdoorSightseeingScorer } from './outdoor-sightseeing.scorer';
import type { DailyWeather } from '../weather.types';

const storm: DailyWeather = {
  date: '2026-07-07', weatherCode: 95, tempMaxC: 6, tempMinC: 2,
  rainMm: 22, snowfallCm: 0, windSpeedMax: 48, windGustsMax: 70,
  windDirectionDominant: 200, precipitationProbabilityMax: 95,
};

describe('indoorSightseeingScorer', () => {
  it('is INDOOR_SIGHTSEEING', () =>
    expect(indoorSightseeingScorer.activity).toBe('INDOOR_SIGHTSEEING'));

  it('is the inverse of the outdoor score', () => {
    expect(indoorSightseeingScorer.scoreDay(storm)).toBe(
      100 - outdoorSightseeingScorer.scoreDay(storm),
    );
  });

  it('scores a stormy day highly', () => {
    expect(indoorSightseeingScorer.scoreDay(storm)).toBeGreaterThanOrEqual(75);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec nx test weather-domain -- indoor-sightseeing.scorer`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement the scorer**

`indoor-sightseeing.scorer.ts`:
```ts
import type { ActivityScorer } from './activity-scorer';
import type { DailyWeather } from '../weather.types';
import { clampScore } from './score-utils';
import { outdoorSightseeingScorer } from './outdoor-sightseeing.scorer';

export const indoorSightseeingScorer: ActivityScorer = {
  activity: 'INDOOR_SIGHTSEEING',
  scoreDay(day: DailyWeather): number {
    return clampScore(100 - outdoorSightseeingScorer.scoreDay(day));
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec nx test weather-domain -- indoor-sightseeing.scorer`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add libs/weather-domain/src/domain/scoring/indoor-sightseeing.scorer.*
git commit -m "feat(weather-domain): indoor sightseeing scorer (outdoor inverse)"
```

---

## Task 7: Scorer registry and `rankActivities`

**Files:**
- Create: `libs/weather-domain/src/domain/scoring/registry.ts`
- Create: `libs/weather-domain/src/domain/rank-activities.ts`
- Test: `libs/weather-domain/src/domain/rank-activities.spec.ts`

**Interfaces:**
- Consumes: all four scorers, `Forecast`, `CityRanking`, `clampScore`.
- Produces:
  - `export const scorers: ActivityScorer[]` (order: skiing, surfing, outdoor, indoor).
  - `export function rankActivities(forecast: Forecast): CityRanking`.

- [ ] **Step 1: Write the failing test**

`rank-activities.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { rankActivities } from './rank-activities';
import type { Forecast, DailyWeather } from './weather.types';

function day(partial: Partial<DailyWeather>): DailyWeather {
  return {
    date: '2026-07-07', weatherCode: 0, tempMaxC: 22, tempMinC: 16,
    rainMm: 0, snowfallCm: 0, windSpeedMax: 8, windGustsMax: 12,
    windDirectionDominant: 180, precipitationProbabilityMax: 5, ...partial,
  };
}

const forecast: Forecast = {
  location: { name: 'Testville', latitude: 1, longitude: 2, timezone: 'GMT' },
  days: [day({ date: '2026-07-07' }), day({ date: '2026-07-08', tempMaxC: 24 })],
};

describe('rankActivities', () => {
  it('returns one ranking per activity, each with per-day detail', () => {
    const result = rankActivities(forecast);
    expect(result.rankings).toHaveLength(4);
    for (const r of result.rankings) {
      expect(r.daily).toHaveLength(2);
      expect(r.daily[0].weather.date).toBe('2026-07-07');
    }
  });

  it('sorts rankings by overallScore descending', () => {
    const scores = rankActivities(forecast).rankings.map((r) => r.overallScore);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('ranks outdoor sightseeing top on clear mild days', () => {
    expect(rankActivities(forecast).rankings[0].activity).toBe('OUTDOOR_SIGHTSEEING');
  });

  it('computes overallScore as the rounded mean of daily scores', () => {
    const r = rankActivities(forecast).rankings.find((x) => x.activity === 'SKIING')!;
    const mean = Math.round(r.daily.reduce((a, d) => a + d.score, 0) / r.daily.length);
    expect(r.overallScore).toBe(mean);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec nx test weather-domain -- rank-activities`
Expected: FAIL — cannot resolve `./rank-activities`.

- [ ] **Step 3: Implement registry and ranking**

`registry.ts`:
```ts
import type { ActivityScorer } from './activity-scorer';
import { skiingScorer } from './skiing.scorer';
import { surfingScorer } from './surfing.scorer';
import { outdoorSightseeingScorer } from './outdoor-sightseeing.scorer';
import { indoorSightseeingScorer } from './indoor-sightseeing.scorer';

// Add a new activity by adding its scorer here (and the Activity union + enum).
export const scorers: ActivityScorer[] = [
  skiingScorer,
  surfingScorer,
  outdoorSightseeingScorer,
  indoorSightseeingScorer,
];
```

`rank-activities.ts`:
```ts
import type { CityRanking, Forecast } from './weather.types';
import { clampScore } from './scoring/score-utils';
import { scorers } from './scoring/registry';

export function rankActivities(forecast: Forecast): CityRanking {
  const rankings = scorers
    .map((scorer) => {
      const daily = forecast.days.map((weather) => ({
        date: weather.date,
        score: clampScore(scorer.scoreDay(weather)),
        weather,
      }));
      const overallScore = Math.round(
        daily.reduce((sum, d) => sum + d.score, 0) / daily.length,
      );
      return { activity: scorer.activity, overallScore, daily };
    })
    .sort((a, b) => b.overallScore - a.overallScore);

  return { location: forecast.location, rankings };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec nx test weather-domain -- rank-activities`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add libs/weather-domain/src/domain/scoring/registry.ts libs/weather-domain/src/domain/rank-activities.*
git commit -m "feat(weather-domain): scorer registry and rankActivities"
```

---

## Task 8: Open-Meteo client

**Files:**
- Create: `libs/weather-domain/src/integration/open-meteo.client.ts`
- Test: `libs/weather-domain/src/integration/open-meteo.client.spec.ts`

**Interfaces:**
- Consumes: `Location`, `Forecast`, `DailyWeather`, `CityNotFoundError`, `UpstreamError`.
- Produces:
  - `type FetchFn = typeof globalThis.fetch`
  - `interface OpenMeteoClientOptions { fetchFn?: FetchFn; geocodingBaseUrl?: string; forecastBaseUrl?: string }`
  - `class OpenMeteoClient` with `geocode(city: string): Promise<Location>` and `fetchForecast(location: Location): Promise<Forecast>`.

Defaults: `geocodingBaseUrl='https://geocoding-api.open-meteo.com/v1/search'`, `forecastBaseUrl='https://api.open-meteo.com/v1/forecast'`, `fetchFn=globalThis.fetch`.

- [ ] **Step 1: Write the failing test**

`open-meteo.client.spec.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { OpenMeteoClient } from './open-meteo.client';
import { CityNotFoundError, UpstreamError } from '../domain/errors';
import type { Location } from '../domain/weather.types';

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 500, json: async () => body } as Response;
}

const saoPaulo: Location = {
  name: 'São Paulo', admin1: 'São Paulo', country: 'Brazil',
  latitude: -23.5475, longitude: -46.63611, timezone: 'America/Sao_Paulo',
};

describe('OpenMeteoClient.geocode', () => {
  it('maps the first result to a Location', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ results: [{ name: 'São Paulo', admin1: 'São Paulo', country: 'Brazil', latitude: -23.5475, longitude: -46.63611, timezone: 'America/Sao_Paulo' }] }),
    );
    const client = new OpenMeteoClient({ fetchFn });
    await expect(client.geocode('sao')).resolves.toEqual(saoPaulo);
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(String(fetchFn.mock.calls[0][0])).toContain('name=sao');
  });

  it('throws CityNotFoundError when results is absent', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ generationtime_ms: 0.1 }));
    const client = new OpenMeteoClient({ fetchFn });
    await expect(client.geocode('zzzz')).rejects.toBeInstanceOf(CityNotFoundError);
  });

  it('throws UpstreamError on non-ok response', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}, false));
    const client = new OpenMeteoClient({ fetchFn });
    await expect(client.geocode('sao')).rejects.toBeInstanceOf(UpstreamError);
  });
});

describe('OpenMeteoClient.fetchForecast', () => {
  it('transposes columnar daily arrays and converts unixtime to ISO date', async () => {
    // 1783382400 = 2026-07-15T00:00:00Z; with utc_offset_seconds 0 -> 2026-07-15
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({
        utc_offset_seconds: 0,
        daily: {
          time: [1783382400, 1783468800],
          temperature_2m_max: [20.4, 21.1],
          temperature_2m_min: [13.4, 14.0],
          rain_sum: [1.1, 0],
          snowfall_sum: [0, 0],
          wind_speed_10m_max: [12.8, 10.2],
          wind_direction_10m_dominant: [258, 240],
          wind_gusts_10m_max: [36.7, 30.0],
          weather_code: [51, 1],
          precipitation_probability_max: [78, 20],
        },
      }),
    );
    const client = new OpenMeteoClient({ fetchFn });
    const forecast = await client.fetchForecast(saoPaulo);

    expect(forecast.location).toEqual(saoPaulo);
    expect(forecast.days).toHaveLength(2);
    expect(forecast.days[0]).toEqual({
      date: '2026-07-15', weatherCode: 51, tempMaxC: 20.4, tempMinC: 13.4,
      rainMm: 1.1, snowfallCm: 0, windSpeedMax: 12.8, windGustsMax: 36.7,
      windDirectionDominant: 258, precipitationProbabilityMax: 78,
    });
    const url = String(fetchFn.mock.calls[0][0]);
    expect(url).toContain('latitude=-23.5475');
    expect(url).toContain('timeformat=unixtime');
    expect(url).toContain('timezone=auto');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec nx test weather-domain -- open-meteo.client`
Expected: FAIL — cannot resolve `./open-meteo.client`.

- [ ] **Step 3: Implement the client**

`open-meteo.client.ts`:
```ts
import type { DailyWeather, Forecast, Location } from '../domain/weather.types';
import { CityNotFoundError, UpstreamError } from '../domain/errors';

export type FetchFn = typeof globalThis.fetch;

export interface OpenMeteoClientOptions {
  fetchFn?: FetchFn;
  geocodingBaseUrl?: string;
  forecastBaseUrl?: string;
}

const DAILY_VARS = [
  'temperature_2m_max',
  'temperature_2m_min',
  'rain_sum',
  'snowfall_sum',
  'wind_speed_10m_max',
  'wind_direction_10m_dominant',
  'wind_gusts_10m_max',
  'weather_code',
  'precipitation_probability_max',
].join(',');

interface GeocodingResult {
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

interface ForecastResponse {
  utc_offset_seconds: number;
  daily: {
    time: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    rain_sum: number[];
    snowfall_sum: number[];
    wind_speed_10m_max: number[];
    wind_direction_10m_dominant: number[];
    wind_gusts_10m_max: number[];
    weather_code: number[];
    precipitation_probability_max: number[];
  };
}

function unixToIsoDate(unixSeconds: number, utcOffsetSeconds: number): string {
  return new Date((unixSeconds + utcOffsetSeconds) * 1000).toISOString().slice(0, 10);
}

export class OpenMeteoClient {
  private readonly fetchFn: FetchFn;
  private readonly geocodingBaseUrl: string;
  private readonly forecastBaseUrl: string;

  constructor(options: OpenMeteoClientOptions = {}) {
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
    this.geocodingBaseUrl =
      options.geocodingBaseUrl ?? 'https://geocoding-api.open-meteo.com/v1/search';
    this.forecastBaseUrl =
      options.forecastBaseUrl ?? 'https://api.open-meteo.com/v1/forecast';
  }

  async geocode(city: string): Promise<Location> {
    const url = new URL(this.geocodingBaseUrl);
    url.searchParams.set('name', city);
    url.searchParams.set('count', '1');

    const body = await this.getJson<{ results?: GeocodingResult[] }>(url);
    const first = body.results?.[0];
    if (!first) throw new CityNotFoundError(city);

    return {
      name: first.name,
      admin1: first.admin1,
      country: first.country,
      latitude: first.latitude,
      longitude: first.longitude,
      timezone: first.timezone,
    };
  }

  async fetchForecast(location: Location): Promise<Forecast> {
    const url = new URL(this.forecastBaseUrl);
    url.searchParams.set('latitude', String(location.latitude));
    url.searchParams.set('longitude', String(location.longitude));
    url.searchParams.set('daily', DAILY_VARS);
    url.searchParams.set('timeformat', 'unixtime');
    url.searchParams.set('format', 'json');
    url.searchParams.set('timezone', 'auto');

    const body = await this.getJson<ForecastResponse>(url);
    const d = body.daily;
    const days: DailyWeather[] = d.time.map((time, i) => ({
      date: unixToIsoDate(time, body.utc_offset_seconds),
      weatherCode: d.weather_code[i],
      tempMaxC: d.temperature_2m_max[i],
      tempMinC: d.temperature_2m_min[i],
      rainMm: d.rain_sum[i],
      snowfallCm: d.snowfall_sum[i],
      windSpeedMax: d.wind_speed_10m_max[i],
      windGustsMax: d.wind_gusts_10m_max[i],
      windDirectionDominant: d.wind_direction_10m_dominant[i],
      precipitationProbabilityMax: d.precipitation_probability_max[i],
    }));

    return { location, days };
  }

  private async getJson<T>(url: URL): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchFn(url);
    } catch (cause) {
      throw new UpstreamError(`Open-Meteo request failed: ${String(cause)}`);
    }
    if (!response.ok) {
      throw new UpstreamError(`Open-Meteo responded with status ${response.status}`);
    }
    return (await response.json()) as T;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec nx test weather-domain -- open-meteo.client`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add libs/weather-domain/src/integration
git commit -m "feat(weather-domain): Open-Meteo client (geocode + forecast)"
```

---

## Task 9: WeatherRankingService and public API barrel

**Files:**
- Create: `libs/weather-domain/src/service/weather-ranking.service.ts`
- Test: `libs/weather-domain/src/service/weather-ranking.service.spec.ts`
- Modify: `libs/weather-domain/src/index.ts`

**Interfaces:**
- Consumes: `OpenMeteoClient` (as a structural dependency), `rankActivities`, `InvalidInputError`, `CityRanking`.
- Produces:
  - `interface WeatherProvider { geocode(city: string): Promise<Location>; fetchForecast(location: Location): Promise<Forecast> }`
  - `class WeatherRankingService { constructor(provider: WeatherProvider); rankForCity(city: string): Promise<CityRanking> }`
  - Barrel `index.ts` re-exporting types, errors, `OpenMeteoClient`, `WeatherRankingService`, `rankActivities`, `scorers`.

- [ ] **Step 1: Write the failing test**

`weather-ranking.service.spec.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { WeatherRankingService, type WeatherProvider } from './weather-ranking.service';
import { InvalidInputError } from '../domain/errors';
import type { Forecast, Location } from '../domain/weather.types';

const location: Location = { name: 'Oslo', latitude: 59.9, longitude: 10.7, timezone: 'Europe/Oslo' };
const forecast: Forecast = {
  location,
  days: [
    { date: '2026-01-01', weatherCode: 71, tempMaxC: -4, tempMinC: -9, rainMm: 0, snowfallCm: 9,
      windSpeedMax: 10, windGustsMax: 18, windDirectionDominant: 0, precipitationProbabilityMax: 80 },
  ],
};

function providerStub(): WeatherProvider {
  return {
    geocode: vi.fn().mockResolvedValue(location),
    fetchForecast: vi.fn().mockResolvedValue(forecast),
  };
}

describe('WeatherRankingService', () => {
  it('geocodes, fetches, and ranks for a city', async () => {
    const provider = providerStub();
    const result = await new WeatherRankingService(provider).rankForCity('  Oslo  ');
    expect(provider.geocode).toHaveBeenCalledWith('Oslo'); // trimmed
    expect(provider.fetchForecast).toHaveBeenCalledWith(location);
    expect(result.location).toEqual(location);
    expect(result.rankings).toHaveLength(4);
    expect(result.rankings[0].activity).toBe('SKIING'); // snowy cold day
  });

  it('rejects empty input before calling the provider', async () => {
    const provider = providerStub();
    await expect(new WeatherRankingService(provider).rankForCity('   ')).rejects.toBeInstanceOf(
      InvalidInputError,
    );
    expect(provider.geocode).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec nx test weather-domain -- weather-ranking.service`
Expected: FAIL — cannot resolve `./weather-ranking.service`.

- [ ] **Step 3: Implement the service**

`weather-ranking.service.ts`:
```ts
import type { CityRanking, Forecast, Location } from '../domain/weather.types';
import { InvalidInputError } from '../domain/errors';
import { rankActivities } from '../domain/rank-activities';

export interface WeatherProvider {
  geocode(city: string): Promise<Location>;
  fetchForecast(location: Location): Promise<Forecast>;
}

export class WeatherRankingService {
  constructor(private readonly provider: WeatherProvider) {}

  async rankForCity(city: string): Promise<CityRanking> {
    const trimmed = city.trim();
    if (!trimmed) throw new InvalidInputError('city must not be empty');
    const location = await this.provider.geocode(trimmed);
    const forecast = await this.provider.fetchForecast(location);
    return rankActivities(forecast);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec nx test weather-domain -- weather-ranking.service`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the public API barrel**

`libs/weather-domain/src/index.ts` (replace the placeholder):
```ts
export type {
  Activity,
  DailyWeather,
  Location,
  Forecast,
  DailyScore,
  ActivityRanking,
  CityRanking,
} from './domain/weather.types';
export { CityNotFoundError, UpstreamError, InvalidInputError } from './domain/errors';
export { rankActivities } from './domain/rank-activities';
export { scorers } from './domain/scoring/registry';
export type { ActivityScorer } from './domain/scoring/activity-scorer';
export { OpenMeteoClient } from './integration/open-meteo.client';
export type { OpenMeteoClientOptions } from './integration/open-meteo.client';
export {
  WeatherRankingService,
  type WeatherProvider,
} from './service/weather-ranking.service';
```

- [ ] **Step 6: Verify the whole lib passes typecheck, lint, and tests**

Run: `pnpm exec nx run-many -t typecheck lint test-ci --projects=weather-domain`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add libs/weather-domain/src/service libs/weather-domain/src/index.ts
git commit -m "feat(weather-domain): ranking service and public API"
```

---

## Task 10: Scaffold the `weather-bff` app

**Files:**
- Create: `apps/weather-bff/package.json`
- Create: `apps/weather-bff/project.json`
- Create: `apps/weather-bff/tsconfig.json`, `tsconfig.app.json`, `tsconfig.spec.json`
- Create: `apps/weather-bff/vite.config.mts`
- Create: `apps/weather-bff/eslint.config.mjs`
- Create: `apps/weather-bff/src/config.ts`
- Modify: root `tsconfig.json` (add reference)

**Interfaces:**
- Produces: an Nx project `weather-bff` (`@collinson/weather-bff`) with inferred `lint`/`test`/`typecheck` and explicit `serve`/`start` targets; `export const config` (port + base URLs).

- [ ] **Step 1: Create the app package.json**

`apps/weather-bff/package.json`:
```json
{
  "name": "@collinson/weather-bff",
  "private": true,
  "type": "module",
  "dependencies": {
    "@apollo/server": "^4.11.0",
    "@collinson/weather-domain": "workspace:*",
    "graphql": "^16.9.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0"
  }
}
```

- [ ] **Step 2: Create the tsconfigs**

`apps/weather-bff/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "files": [],
  "include": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.spec.json" }
  ]
}
```

`apps/weather-bff/tsconfig.app.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "module": "esnext",
    "moduleResolution": "bundler",
    "types": ["node"],
    "tsBuildInfoFile": "dist/tsconfig.app.tsbuildinfo"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts", "tests/**/*.spec.ts", "vite.config.mts"]
}
```

`apps/weather-bff/tsconfig.spec.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "out-tsc/vitest",
    "types": ["node", "vitest/globals"],
    "module": "esnext",
    "moduleResolution": "bundler"
  },
  "include": [
    "src/**/*.spec.ts",
    "tests/**/*.spec.ts",
    "vite.config.mts"
  ]
}
```

- [ ] **Step 3: Create the Vitest config**

`apps/weather-bff/vite.config.mts`:
```ts
/// <reference types='vitest' />
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/weather-bff',
  test: {
    name: '@collinson/weather-bff',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
```

- [ ] **Step 4: Create the ESLint config**

`apps/weather-bff/eslint.config.mjs`:
```js
import baseConfig from '../../eslint.config.mjs';

export default [...baseConfig];
```

- [ ] **Step 5: Create the project.json (serve/start targets)**

`apps/weather-bff/project.json`:
```json
{
  "name": "weather-bff",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "projectType": "application",
  "sourceRoot": "apps/weather-bff/src",
  "targets": {
    "serve": {
      "executor": "nx:run-commands",
      "options": {
        "command": "tsx watch src/main.ts",
        "cwd": "apps/weather-bff"
      }
    },
    "start": {
      "executor": "nx:run-commands",
      "options": {
        "command": "tsx src/main.ts",
        "cwd": "apps/weather-bff"
      }
    }
  }
}
```

- [ ] **Step 6: Create the config module**

`apps/weather-bff/src/config.ts`:
```ts
export const config = {
  port: Number(process.env.PORT ?? 4000),
  geocodingBaseUrl:
    process.env.OPEN_METEO_GEOCODING_URL ?? 'https://geocoding-api.open-meteo.com/v1/search',
  forecastBaseUrl:
    process.env.OPEN_METEO_FORECAST_URL ?? 'https://api.open-meteo.com/v1/forecast',
};
```

- [ ] **Step 7: Add the app to the root tsconfig references**

In root `tsconfig.json`, add `{ "path": "./apps/weather-bff" }` to the `references` array.

- [ ] **Step 8: Install and verify the project is recognized**

```bash
pnpm install
pnpm exec nx show project weather-bff --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(Object.keys(JSON.parse(s).targets)))"
```
Expected: targets include `serve`, `start`, `lint`, `test`, `typecheck`.

- [ ] **Step 9: Commit**

```bash
git add apps/weather-bff package.json pnpm-lock.yaml tsconfig.json
git commit -m "feat(weather-bff): scaffold Apollo BFF app"
```

---

## Task 11: GraphQL schema and resolvers

**Files:**
- Create: `apps/weather-bff/src/graphql/schema.ts`
- Create: `apps/weather-bff/src/graphql/resolvers.ts`
- Create: `apps/weather-bff/src/context.ts`
- Test: `apps/weather-bff/tests/resolvers.spec.ts`

**Interfaces:**
- Consumes: `WeatherRankingService`, `OpenMeteoClient`, error classes, `CityRanking` from `@collinson/weather-domain`.
- Produces:
  - `export const typeDefs: string` (SDL).
  - `interface GraphQLContext { service: Pick<WeatherRankingService, 'rankForCity'> }`
  - `export const resolvers` with `Query.rankActivities`.
  - `export function buildContext(): GraphQLContext`.

- [ ] **Step 1: Write the failing end-to-end resolver test**

`apps/weather-bff/tests/resolvers.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { ApolloServer } from '@apollo/server';
import { typeDefs } from '../src/graphql/schema';
import { resolvers, type GraphQLContext } from '../src/graphql/resolvers';
import { CityNotFoundError, type CityRanking } from '@collinson/weather-domain';

const ranking: CityRanking = {
  location: { name: 'Lisbon', country: 'Portugal', latitude: 38.7, longitude: -9.1, timezone: 'Europe/Lisbon' },
  rankings: [
    { activity: 'OUTDOOR_SIGHTSEEING', overallScore: 88, daily: [
      { date: '2026-07-07', score: 88, weather: {
        date: '2026-07-07', weatherCode: 0, tempMaxC: 26, tempMinC: 18, rainMm: 0, snowfallCm: 0,
        windSpeedMax: 12, windGustsMax: 20, windDirectionDominant: 300, precipitationProbabilityMax: 5 } },
    ] },
    { activity: 'SURFING', overallScore: 60, daily: [] },
    { activity: 'INDOOR_SIGHTSEEING', overallScore: 20, daily: [] },
    { activity: 'SKIING', overallScore: 0, daily: [] },
  ],
};

const QUERY = `
  query Rank($city: String!) {
    rankActivities(city: $city) {
      location { name country }
      rankings { activity overallScore daily { date score weather { weatherCode tempMaxC } } }
    }
  }
`;

function server(service: GraphQLContext['service']) {
  const apollo = new ApolloServer<GraphQLContext>({ typeDefs, resolvers });
  return { apollo, contextValue: { service } };
}

describe('rankActivities resolver', () => {
  it('returns the ranking for a city', async () => {
    const { apollo, contextValue } = server({ rankForCity: async () => ranking });
    const res = await apollo.executeOperation(
      { query: QUERY, variables: { city: 'Lisbon' } },
      { contextValue },
    );
    expect(res.body.kind).toBe('single');
    if (res.body.kind !== 'single') throw new Error('unexpected');
    expect(res.body.singleResult.errors).toBeUndefined();
    const data = res.body.singleResult.data?.rankActivities as any;
    expect(data.location.name).toBe('Lisbon');
    expect(data.rankings[0].activity).toBe('OUTDOOR_SIGHTSEEING');
    expect(data.rankings[0].daily[0].weather.weatherCode).toBe(0);
  });

  it('surfaces CityNotFoundError as a CITY_NOT_FOUND GraphQL error', async () => {
    const { apollo, contextValue } = server({
      rankForCity: async () => { throw new CityNotFoundError('zzz'); },
    });
    const res = await apollo.executeOperation(
      { query: QUERY, variables: { city: 'zzz' } },
      { contextValue },
    );
    if (res.body.kind !== 'single') throw new Error('unexpected');
    expect(res.body.singleResult.errors?.[0].extensions?.code).toBe('CITY_NOT_FOUND');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec nx test weather-bff -- resolvers`
Expected: FAIL — cannot resolve `../src/graphql/schema`.

- [ ] **Step 3: Write the SDL schema**

`apps/weather-bff/src/graphql/schema.ts`:
```ts
export const typeDefs = /* GraphQL */ `
  enum Activity {
    SKIING
    SURFING
    OUTDOOR_SIGHTSEEING
    INDOOR_SIGHTSEEING
  }

  type Location {
    name: String!
    admin1: String
    country: String
    latitude: Float!
    longitude: Float!
    timezone: String!
  }

  type DailyWeather {
    date: String!
    weatherCode: Int!
    tempMaxC: Float!
    tempMinC: Float!
    rainMm: Float!
    snowfallCm: Float!
    windSpeedMax: Float!
    windGustsMax: Float!
    windDirectionDominant: Int!
    precipitationProbabilityMax: Int!
  }

  type DailyScore {
    date: String!
    score: Int!
    weather: DailyWeather!
  }

  type ActivityRanking {
    activity: Activity!
    overallScore: Int!
    daily: [DailyScore!]!
  }

  type CityRanking {
    location: Location!
    rankings: [ActivityRanking!]!
  }

  type Query {
    rankActivities(city: String!): CityRanking!
  }
`;
```

- [ ] **Step 4: Write the resolvers**

`apps/weather-bff/src/graphql/resolvers.ts`:
```ts
import { GraphQLError } from 'graphql';
import {
  CityNotFoundError,
  InvalidInputError,
  UpstreamError,
  type CityRanking,
  type WeatherRankingService,
} from '@collinson/weather-domain';

export interface GraphQLContext {
  service: Pick<WeatherRankingService, 'rankForCity'>;
}

function toGraphQLError(error: unknown): GraphQLError {
  if (
    error instanceof CityNotFoundError ||
    error instanceof InvalidInputError ||
    error instanceof UpstreamError
  ) {
    return new GraphQLError(error.message, { extensions: { code: error.code } });
  }
  return new GraphQLError('Unexpected error', { extensions: { code: 'INTERNAL_SERVER_ERROR' } });
}

export const resolvers = {
  Query: {
    rankActivities: async (
      _parent: unknown,
      args: { city: string },
      context: GraphQLContext,
    ): Promise<CityRanking> => {
      try {
        return await context.service.rankForCity(args.city);
      } catch (error) {
        throw toGraphQLError(error);
      }
    },
  },
};
```

- [ ] **Step 5: Write the context builder**

`apps/weather-bff/src/context.ts`:
```ts
import { OpenMeteoClient, WeatherRankingService } from '@collinson/weather-domain';
import { config } from './config';
import type { GraphQLContext } from './graphql/resolvers';

export function buildContext(): GraphQLContext {
  const client = new OpenMeteoClient({
    geocodingBaseUrl: config.geocodingBaseUrl,
    forecastBaseUrl: config.forecastBaseUrl,
  });
  return { service: new WeatherRankingService(client) };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm exec nx test weather-bff -- resolvers`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add apps/weather-bff/src/graphql apps/weather-bff/src/context.ts apps/weather-bff/tests
git commit -m "feat(weather-bff): GraphQL schema, resolvers, context"
```

---

## Task 12: Server bootstrap and manual verification

**Files:**
- Create: `apps/weather-bff/src/main.ts`

**Interfaces:**
- Consumes: `typeDefs`, `resolvers`, `buildContext`, `config`.

- [ ] **Step 1: Write the server entrypoint**

`apps/weather-bff/src/main.ts`:
```ts
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { typeDefs } from './graphql/schema';
import { resolvers, type GraphQLContext } from './graphql/resolvers';
import { buildContext } from './context';
import { config } from './config';

async function main(): Promise<void> {
  const server = new ApolloServer<GraphQLContext>({ typeDefs, resolvers });
  const { url } = await startStandaloneServer(server, {
    context: async () => buildContext(),
    listen: { port: config.port },
  });
  console.log(`weather-bff ready at ${url}`);
}

main().catch((error) => {
  console.error('Failed to start weather-bff', error);
  process.exit(1);
});
```

- [ ] **Step 2: Typecheck and lint the app**

Run: `pnpm exec nx run-many -t typecheck lint --projects=weather-bff`
Expected: both PASS.

- [ ] **Step 3: Start the server (background) and query it live**

```bash
pnpm exec nx serve weather-bff &
sleep 4
curl -s http://localhost:4000/ \
  -H 'Content-Type: application/json' \
  -d '{"query":"query{ rankActivities(city:\"Lisbon\"){ location{ name country } rankings{ activity overallScore } } }"}'
```
Expected: JSON with `data.rankActivities.location.name` = a Lisbon match and four `rankings` sorted by `overallScore` descending. Then stop the server:
```bash
kill %1 2>/dev/null || true
```

- [ ] **Step 4: Verify the error path**

```bash
pnpm exec nx serve weather-bff &
sleep 4
curl -s http://localhost:4000/ -H 'Content-Type: application/json' \
  -d '{"query":"query{ rankActivities(city:\"zzzzzzzz\"){ location{ name } } }"}'
kill %1 2>/dev/null || true
```
Expected: JSON with `errors[0].extensions.code` = `CITY_NOT_FOUND`.

- [ ] **Step 5: Commit**

```bash
git add apps/weather-bff/src/main.ts
git commit -m "feat(weather-bff): Apollo standalone server bootstrap"
```

---

## Task 13: Documentation — README and trade-offs

**Files:**
- Create: `apps/weather-bff/README.md`
- Modify: root `README.md` (add a "Backend (weather-bff)" section with run instructions)

**Interfaces:** none (docs only).

- [ ] **Step 1: Write the app README**

`apps/weather-bff/README.md` — cover: purpose (BFF), architecture (thin Apollo transport → `weather-domain` lib with injected Open-Meteo client, scoring strategies, pure ranking), how to run (`pnpm exec nx serve weather-bff`, default port 4000, env vars `PORT`/`OPEN_METEO_*`), the GraphQL query shape, and the scoring model summary.

Include this **Omissions & Trade-offs** section verbatim:
```markdown
## Omissions & Trade-offs

- **Surfing uses wind as a proxy** for wave quality. Real surf scoring needs Open-Meteo's
  separate Marine API (wave height/period, coastal only) — the natural next step.
- **Top geocoding match only.** We take `results[0]`; no disambiguation UI for ambiguous names.
- **Runs via `tsx`, not a compiled bundle.** The workspace TS base emits declarations only, so a
  production build would add esbuild/`@nx/esbuild`. Deferred as it adds no behavioural value here.
- **No caching / rate limiting / auth / persistence.** Out of scope for the assessment; each query
  hits Open-Meteo live. Response caching keyed by (city, day) is the obvious first optimization.
```

- [ ] **Step 2: Add a backend section to the root README**

In root `README.md`, add a section documenting `apps/weather-bff`: what it is, `pnpm exec nx serve weather-bff`, the endpoint (`http://localhost:4000/`), and a link to `apps/weather-bff/README.md`.

- [ ] **Step 3: Commit**

```bash
git add apps/weather-bff/README.md README.md
git commit -m "docs(weather-bff): README and trade-offs"
```

---

## Task 14: Full-workspace verification

**Files:** none (verification only).

- [ ] **Step 1: Run all targets across affected projects**

Run: `pnpm exec nx run-many -t typecheck lint test-ci --projects=weather-domain,weather-bff`
Expected: all PASS. If any fail, fix inline and re-run before continuing.

- [ ] **Step 2: Confirm module boundaries hold**

Run: `pnpm exec nx lint weather-bff`
Expected: PASS — the app imports `@collinson/weather-domain` only through its public barrel; no deep imports flagged by `@nx/enforce-module-boundaries`.

- [ ] **Step 3: Final commit if anything changed**

```bash
git add -A
git commit -m "chore(weather-bff): verification fixes" || echo "nothing to commit"
```

---

## Self-Review Notes

- **Spec coverage:** app rename to `weather-bff` (Tasks 10–12) ✓; Apollo SDL-first (Task 11) ✓; `libs/weather-domain` with injected client (Tasks 8–9) ✓; exact geocoding + forecast endpoints/params, unixtime→ISO, columnar transpose (Task 8) ✓; schema mirrors API fields 1:1 (Task 11) ✓; four scorers with weather_code-derived clearness, extensible registry (Tasks 3–7) ✓; ranked activities + per-day detail, overall = mean, sorted desc (Task 7) ✓; error codes CITY_NOT_FOUND / UPSTREAM_ERROR / BAD_USER_INPUT (Tasks 2, 8, 9, 11) ✓; Vitest scorer/service/client/resolver tests ✓; YAGNI trade-offs documented (Task 13) ✓; supply-chain cooldown respected — no new `@nx` plugins, all deps > 2 weeks old (Global Constraints, Task 10) ✓.
- **Type consistency:** `WeatherProvider` (structural) is what `WeatherRankingService` consumes and `OpenMeteoClient` satisfies; `GraphQLContext.service` is `Pick<WeatherRankingService,'rankForCity'>`; scorer names (`skiingScorer`, `surfingScorer`, `outdoorSightseeingScorer`, `indoorSightseeingScorer`) match registry imports; `skyClearness` shared between outdoor and (indirectly) indoor via inversion; field names in SDL match `DailyWeather`/`Location` domain types.
```
