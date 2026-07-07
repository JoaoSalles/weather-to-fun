# City Ranking Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shadcn form (single "city" input + submit) to the weather-app home route that queries the weather-bff `rankActivities` GraphQL endpoint and renders the ranked activities with a 7-day per-day breakdown, fully typed via codegen.

**Architecture:** GraphQL Code Generator reads the BFF's SDL (`typeDefs`) and generates a `TypedDocumentNode` for the frontend operation (`client-preset`, fragment masking off). The home route uses a shadcn Form (react-hook-form + zod), commits the submitted city to state, and renders a `<CityRankings>` child inside `<Suspense>` (skeleton fallback) + a hand-rolled `ErrorBoundary`. Data is fetched with `graphql-request` inside TanStack Query's `useSuspenseQuery`, giving a client-side per-city cache. No shared contract lib — the app owns its generated client; `typeDefs` stays in the BFF.

**Tech Stack:** React 19, React Router 7 (SPA), TanStack Query (`useSuspenseQuery`), graphql-request, GraphQL Code Generator (`@graphql-codegen/cli` + `client-preset`), shadcn/ui, react-hook-form + zod, Tailwind v4, Vitest + Testing Library.

## Global Constraints

- **Supply-chain guardrail:** `pnpm-workspace.yaml` sets `minimumReleaseAge: 20160` (2 weeks). If pnpm refuses a package version, add the exact `name@version` to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml`.
- **TypeScript strict mode** everywhere (`tsconfig.base.json`: `strict`, `noUnusedLocals`, `noImplicitReturns`). No `any` in committed code.
- **Nx inferred targets** — do not add `project.json`. Run tasks via `pnpm exec nx <target> weather-app`.
- **SPA only** (`ssr: false`) — no loaders/actions for this feature; client-side suspense only.
- **GraphQL endpoint:** `import.meta.env.VITE_GRAPHQL_URL` with default `http://localhost:4000/`.
- **Run a single test file:** `pnpm exec nx test-ci weather-app -- <path-substring>` (vitest single run; app config sets `watch:false`).
- **Typecheck:** `pnpm exec nx typecheck weather-app`. Codegen must have run first (generated dir must exist).

---

### Task 1: Dependencies, aliases, and shadcn setup

**Files:**
- Modify: `pnpm-workspace.yaml` (only if the guardrail blocks a version)
- Modify: `apps/weather-app/vite.config.ts` (add `~` resolve alias)
- Modify: `apps/weather-app/tsconfig.app.json` (add `~/*` path)
- Create: `apps/weather-app/components.json`
- Create (via shadcn): `apps/weather-app/app/lib/utils.ts`, `apps/weather-app/app/components/ui/{button,input,label,form,skeleton}.tsx`

**Interfaces:**
- Produces: `~` import alias → `apps/weather-app/app`; shadcn components importable as `~/components/ui/button` etc.; `cn` util at `~/lib/utils`.

- [ ] **Step 1: Install runtime + dev dependencies**

Run (from repo root):
```bash
pnpm add --filter @collinson/weather-app @tanstack/react-query graphql-request graphql react-hook-form zod @hookform/resolvers
pnpm add -D --filter @collinson/weather-app @graphql-codegen/cli @graphql-codegen/client-preset
```
Expected: install succeeds. If pnpm errors with a "published less than" message for any version, note the printed `name@version`, add it to the `minimumReleaseAgeExclude` array in `pnpm-workspace.yaml`, and re-run. `graphql` may already be hoisted at the root — that is fine.

- [ ] **Step 2: Add the `~` alias to Vite**

In `apps/weather-app/vite.config.ts`, add `import path from 'node:path';` at the top, and add a `resolve` block inside the returned config object (sibling of `server`/`build`):
```ts
  resolve: {
    alias: {
      '~': path.resolve(import.meta.dirname, 'app'),
    },
  },
```

- [ ] **Step 3: Add the `~` path to tsconfig**

In `apps/weather-app/tsconfig.app.json`, add to `compilerOptions`:
```json
    "paths": {
      "~/*": ["./app/*"]
    },
```

- [ ] **Step 4: Create `components.json`**

Create `apps/weather-app/components.json`:
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "app/styles/app.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "~/components",
    "utils": "~/lib/utils",
    "ui": "~/components/ui",
    "lib": "~/lib",
    "hooks": "~/hooks"
  },
  "iconLibrary": "lucide"
}
```

- [ ] **Step 5: Add shadcn components**

Run (from `apps/weather-app`):
```bash
cd apps/weather-app && pnpm dlx shadcn@latest add button input label form skeleton -y
```
Expected: creates `app/lib/utils.ts` and `app/components/ui/{button,input,label,form,skeleton}.tsx`, and installs `clsx`, `tailwind-merge`, `class-variance-authority`, `@radix-ui/react-label`, `@radix-ui/react-slot`, and `react-hook-form` (already added). If the guardrail blocks any of these, apply the same `minimumReleaseAgeExclude` fix from Step 1 and re-run. shadcn may append CSS variables to `app/styles/app.css` — keep them.

- [ ] **Step 6: Verify typecheck passes**

Run: `pnpm exec nx typecheck weather-app`
Expected: PASS (no errors). If `~` imports fail to resolve, re-check Steps 2–3.

- [ ] **Step 7: Commit**

```bash
git add apps/weather-app/components.json apps/weather-app/vite.config.ts apps/weather-app/tsconfig.app.json apps/weather-app/app/lib apps/weather-app/app/components/ui apps/weather-app/package.json pnpm-lock.yaml pnpm-workspace.yaml
git commit -m "chore(weather-app): add shadcn, tanstack query, codegen deps and ~ alias"
```

---

### Task 2: GraphQL codegen + typed operation

**Files:**
- Create: `codegen.ts` (repo root)
- Modify: `package.json` (repo root — add `codegen` script)
- Create: `apps/weather-app/app/graphql/operations.ts`
- Create (generated): `apps/weather-app/app/graphql/generated/*`

**Interfaces:**
- Consumes: `typeDefs` (SDL string) from `apps/weather-bff/src/graphql/schema.ts`.
- Produces: `RANK_ACTIVITIES` — a `TypedDocumentNode<{ rankActivities: {...} }, { city: string }>` exported from `apps/weather-app/app/graphql/operations.ts`; the `graphql()` function in `app/graphql/generated`.

- [ ] **Step 1: Create the codegen config**

Create `codegen.ts` at the repo root:
```ts
import type { CodegenConfig } from '@graphql-codegen/cli';
import { typeDefs } from './apps/weather-bff/src/graphql/schema';

const config: CodegenConfig = {
  schema: typeDefs,
  documents: [
    'apps/weather-app/app/**/*.{ts,tsx}',
    '!apps/weather-app/app/graphql/generated/**',
  ],
  ignoreNoDocuments: true,
  generates: {
    'apps/weather-app/app/graphql/generated/': {
      preset: 'client',
      presetConfig: {
        fragmentMasking: false,
      },
    },
  },
};

export default config;
```

- [ ] **Step 2: Add the codegen script**

In the repo-root `package.json`, add to `"scripts"`:
```json
    "codegen": "graphql-codegen --config codegen.ts"
```

- [ ] **Step 3: Write the operation**

Create `apps/weather-app/app/graphql/operations.ts`:
```ts
import { graphql } from './generated';

export const RANK_ACTIVITIES = graphql(`
  query RankActivities($city: String!) {
    rankActivities(city: $city) {
      location {
        name
        admin1
        country
        latitude
        longitude
        timezone
      }
      rankings {
        activity
        overallScore
        daily {
          date
          score
          weather {
            date
            weatherCode
            tempMaxC
            tempMinC
            rainMm
            snowfallCm
            windSpeedMax
            windGustsMax
            windDirectionDominant
            precipitationProbabilityMax
          }
        }
      }
    }
  }
`);
```
Note: `./generated` does not exist yet, so this line will show a TS error until Step 4 runs. That is expected.

- [ ] **Step 4: Run codegen**

Run (from repo root): `pnpm codegen`
Expected: creates `apps/weather-app/app/graphql/generated/` (contains `gql.ts`, `graphql.ts`, `index.ts`) and prints success. The `import { graphql }` in `operations.ts` now resolves.

- [ ] **Step 5: Verify types**

Run: `pnpm exec nx typecheck weather-app`
Expected: PASS. `RANK_ACTIVITIES` is now a typed document (hover/inspection shows `TypedDocumentNode`).

- [ ] **Step 6: Commit**

```bash
git add codegen.ts package.json apps/weather-app/app/graphql/operations.ts apps/weather-app/app/graphql/generated pnpm-lock.yaml
git commit -m "feat(weather-app): generate typed rankActivities document from bff schema"
```

---

### Task 3: GraphQL client wrapper + QueryClientProvider

**Files:**
- Create: `apps/weather-app/app/graphql/client.ts`
- Test: `apps/weather-app/tests/graphql/client.spec.ts`
- Modify: `apps/weather-app/app/root.tsx`

**Interfaces:**
- Consumes: `RANK_ACTIVITIES` from `~/graphql/operations`.
- Produces: `GQL_URL: string`; `rankActivities(city: string)` returning `Promise` of the `rankActivities` result object (typed via inference from `RANK_ACTIVITIES`). Consumed by Task 4.

- [ ] **Step 1: Write the failing test**

Create `apps/weather-app/tests/graphql/client.spec.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const requestMock = vi.fn();
vi.mock('graphql-request', () => ({ request: requestMock }));

import { rankActivities, GQL_URL } from '../../app/graphql/client';
import { RANK_ACTIVITIES } from '../../app/graphql/operations';

describe('rankActivities client', () => {
  beforeEach(() => requestMock.mockReset());

  it('defaults GQL_URL to localhost:4000', () => {
    expect(GQL_URL).toBe('http://localhost:4000/');
  });

  it('calls graphql-request with the document and variables and returns rankActivities', async () => {
    const payload = { location: { name: 'London' }, rankings: [] };
    requestMock.mockResolvedValue({ rankActivities: payload });

    const result = await rankActivities('London');

    expect(requestMock).toHaveBeenCalledWith(GQL_URL, RANK_ACTIVITIES, { city: 'London' });
    expect(result).toBe(payload);
  });

  it('propagates errors thrown by graphql-request', async () => {
    requestMock.mockRejectedValue(new Error('City not found'));
    await expect(rankActivities('Nowhere')).rejects.toThrow('City not found');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec nx test-ci weather-app -- client.spec`
Expected: FAIL — cannot resolve `../../app/graphql/client`.

- [ ] **Step 3: Write the client**

Create `apps/weather-app/app/graphql/client.ts`:
```ts
import { request } from 'graphql-request';
import { RANK_ACTIVITIES } from './operations';

export const GQL_URL: string =
  import.meta.env.VITE_GRAPHQL_URL ?? 'http://localhost:4000/';

export async function rankActivities(city: string) {
  const data = await request(GQL_URL, RANK_ACTIVITIES, { city });
  return data.rankActivities;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec nx test-ci weather-app -- client.spec`
Expected: PASS (3 tests).

- [ ] **Step 5: Add QueryClientProvider to root**

In `apps/weather-app/app/root.tsx`, add imports:
```ts
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
```
Replace the default export with:
```tsx
export default function App() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
```

- [ ] **Step 6: Verify typecheck + tests**

Run: `pnpm exec nx typecheck weather-app && pnpm exec nx test-ci weather-app -- client.spec`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/weather-app/app/graphql/client.ts apps/weather-app/tests/graphql/client.spec.ts apps/weather-app/app/root.tsx
git commit -m "feat(weather-app): add graphql client wrapper and query provider"
```

---

### Task 4: CityRankings component + skeleton

**Files:**
- Create: `apps/weather-app/app/components/city-rankings.tsx`
- Create: `apps/weather-app/app/components/ranking-skeleton.tsx`
- Test: `apps/weather-app/tests/components/city-rankings.spec.tsx`

**Interfaces:**
- Consumes: `rankActivities` from `~/graphql/client`; `Skeleton` from `~/components/ui/skeleton`.
- Produces: `<CityRankings city={string} />` (suspends via `useSuspenseQuery`); `<RankingSkeleton />`.

- [ ] **Step 1: Write the failing test**

Create `apps/weather-app/tests/components/city-rankings.spec.tsx`:
```tsx
import { Suspense } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const rankActivitiesMock = vi.fn();
vi.mock('../../app/graphql/client', () => ({ rankActivities: rankActivitiesMock }));

import { CityRankings } from '../../app/components/city-rankings';

const sample = {
  location: { name: 'London', admin1: null, country: 'United Kingdom', latitude: 51.5, longitude: -0.1, timezone: 'Europe/London' },
  rankings: [
    { activity: 'INDOOR_SIGHTSEEING', overallScore: 82, daily: [
      { date: '2026-07-07', score: 80, weather: { date: '2026-07-07', weatherCode: 3, tempMaxC: 20, tempMinC: 12, rainMm: 1, snowfallCm: 0, windSpeedMax: 15, windGustsMax: 25, windDirectionDominant: 180, precipitationProbabilityMax: 40 } },
    ] },
    { activity: 'SURFING', overallScore: 64, daily: [
      { date: '2026-07-07', score: 60, weather: { date: '2026-07-07', weatherCode: 3, tempMaxC: 20, tempMinC: 12, rainMm: 1, snowfallCm: 0, windSpeedMax: 15, windGustsMax: 25, windDirectionDominant: 180, precipitationProbabilityMax: 40 } },
    ] },
  ],
};

function renderWithClient(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Suspense fallback={<span>loading</span>}>{ui}</Suspense>
    </QueryClientProvider>,
  );
}

describe('CityRankings', () => {
  beforeEach(() => rankActivitiesMock.mockReset());

  it('renders the location and activities in the order returned, with the daily breakdown', async () => {
    rankActivitiesMock.mockResolvedValue(sample);
    renderWithClient(<CityRankings city="London" />);

    expect(await screen.findByText(/London/)).toBeTruthy();
    const activities = await screen.findAllByRole('heading', { level: 3 });
    expect(activities.map((h) => h.textContent)).toEqual([
      expect.stringContaining('INDOOR_SIGHTSEEING'),
      expect.stringContaining('SURFING'),
    ]);
    expect(screen.getByText('82')).toBeTruthy();
    expect(screen.getAllByText(/2026-07-07/).length).toBeGreaterThan(0);
  });

  it('calls the client with the given city', async () => {
    rankActivitiesMock.mockResolvedValue(sample);
    renderWithClient(<CityRankings city="Paris" />);
    await screen.findByText(/London/);
    expect(rankActivitiesMock).toHaveBeenCalledWith('Paris');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec nx test-ci weather-app -- city-rankings.spec`
Expected: FAIL — cannot resolve `../../app/components/city-rankings`.

- [ ] **Step 3: Create the skeleton**

Create `apps/weather-app/app/components/ranking-skeleton.tsx`:
```tsx
import { Skeleton } from '~/components/ui/skeleton';

export function RankingSkeleton() {
  return (
    <div className="mt-6 space-y-3" role="status" aria-label="Loading rankings">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}
```

- [ ] **Step 4: Create the component**

Create `apps/weather-app/app/components/city-rankings.tsx`:
```tsx
import { useSuspenseQuery } from '@tanstack/react-query';
import { rankActivities } from '~/graphql/client';

export function CityRankings({ city }: { city: string }) {
  const { data } = useSuspenseQuery({
    queryKey: ['rankActivities', city],
    queryFn: () => rankActivities(city),
  });

  const place = [data.location.name, data.location.admin1, data.location.country]
    .filter(Boolean)
    .join(', ');

  return (
    <section className="mt-6 space-y-4">
      <h2 className="text-lg font-semibold text-text">{place}</h2>
      {data.rankings.map((ranking) => (
        <article key={ranking.activity} className="rounded border border-text-muted/20 p-4">
          <h3 className="flex items-center justify-between font-medium text-text">
            <span>{ranking.activity}</span>
            <span>{ranking.overallScore}</span>
          </h3>
          <ul className="mt-2 flex flex-wrap gap-3 text-sm text-text-muted">
            {ranking.daily.map((day) => (
              <li key={day.date}>
                {day.date}: {day.score}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec nx test-ci weather-app -- city-rankings.spec`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/weather-app/app/components/city-rankings.tsx apps/weather-app/app/components/ranking-skeleton.tsx apps/weather-app/tests/components/city-rankings.spec.tsx
git commit -m "feat(weather-app): add CityRankings result view and loading skeleton"
```

---

### Task 5: ErrorBoundary

**Files:**
- Create: `apps/weather-app/app/components/error-boundary.tsx`
- Test: `apps/weather-app/tests/components/error-boundary.spec.tsx`

**Interfaces:**
- Produces: `<ErrorBoundary>{children}</ErrorBoundary>` — catches render/suspense errors and shows the error message inline.

- [ ] **Step 1: Write the failing test**

Create `apps/weather-app/tests/components/error-boundary.spec.tsx`:
```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../../app/components/error-boundary';

function Boom(): never {
  throw new Error('City not found');
}

describe('ErrorBoundary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders the error message when a child throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert').textContent).toContain('City not found');
  });

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <span>all good</span>
      </ErrorBoundary>,
    );
    expect(screen.getByText('all good')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec nx test-ci weather-app -- error-boundary.spec`
Expected: FAIL — cannot resolve `../../app/components/error-boundary`.

- [ ] **Step 3: Create the ErrorBoundary**

Create `apps/weather-app/app/components/error-boundary.tsx`:
```tsx
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('CityRankings failed', error, info);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <p role="alert" className="mt-6 text-text">
          {this.state.error.message}
        </p>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec nx test-ci weather-app -- error-boundary.spec`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/weather-app/app/components/error-boundary.tsx apps/weather-app/tests/components/error-boundary.spec.tsx
git commit -m "feat(weather-app): add error boundary for ranking failures"
```

---

### Task 6: Home route form + wiring

**Files:**
- Modify: `apps/weather-app/app/routes/home.tsx`
- Delete: `apps/weather-app/tests/routes/_index.spec.tsx` (stale — imports non-existent `app/app`)
- Test: `apps/weather-app/tests/routes/home.spec.tsx`

**Interfaces:**
- Consumes: `CityRankings`, `RankingSkeleton`, `ErrorBoundary`, shadcn `Form`/`Input`/`Button`, react-hook-form, zod.
- Produces: the finished home route (default export `App`).

- [ ] **Step 1: Write the failing test**

Delete the stale test and create `apps/weather-app/tests/routes/home.spec.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const rankActivitiesMock = vi.fn();
vi.mock('../../app/graphql/client', () => ({ rankActivities: rankActivitiesMock }));

import App from '../../app/routes/home';

const sample = {
  location: { name: 'London', admin1: null, country: 'United Kingdom', latitude: 51.5, longitude: -0.1, timezone: 'Europe/London' },
  rankings: [
    { activity: 'SURFING', overallScore: 64, daily: [
      { date: '2026-07-07', score: 60, weather: { date: '2026-07-07', weatherCode: 3, tempMaxC: 20, tempMinC: 12, rainMm: 1, snowfallCm: 0, windSpeedMax: 15, windGustsMax: 25, windDirectionDominant: 180, precipitationProbabilityMax: 40 } },
    ] },
  ],
};

function renderApp() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  );
}

describe('home route', () => {
  beforeEach(() => rankActivitiesMock.mockReset());

  it('shows a validation message and does not fetch when city is empty', async () => {
    renderApp();
    await userEvent.click(screen.getByRole('button', { name: /rank activities/i }));
    expect(await screen.findByText(/enter a city/i)).toBeTruthy();
    expect(rankActivitiesMock).not.toHaveBeenCalled();
  });

  it('fetches and renders rankings on submit', async () => {
    rankActivitiesMock.mockResolvedValue(sample);
    renderApp();
    await userEvent.type(screen.getByLabelText(/city/i), 'London');
    await userEvent.click(screen.getByRole('button', { name: /rank activities/i }));
    expect(await screen.findByText(/London/)).toBeTruthy();
    expect(screen.getByText('SURFING')).toBeTruthy();
    expect(rankActivitiesMock).toHaveBeenCalledWith('London');
  });

  it('renders the error message when the query fails', async () => {
    rankActivitiesMock.mockRejectedValue(new Error('City not found'));
    renderApp();
    await userEvent.type(screen.getByLabelText(/city/i), 'Nowhere');
    await userEvent.click(screen.getByRole('button', { name: /rank activities/i }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('City not found'));
  });
});
```
Then delete the stale spec:
```bash
git rm apps/weather-app/tests/routes/_index.spec.tsx
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec nx test-ci weather-app -- home.spec`
Expected: FAIL — the current home route has no form/inputs.

- [ ] **Step 3: Implement the home route**

Replace the contents of `apps/weather-app/app/routes/home.tsx`:
```tsx
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { CityRankings } from '~/components/city-rankings';
import { RankingSkeleton } from '~/components/ranking-skeleton';
import { ErrorBoundary } from '~/components/error-boundary';

const formSchema = z.object({
  city: z.string().trim().min(1, 'Enter a city'),
});
type FormValues = z.infer<typeof formSchema>;

export function App() {
  const [city, setCity] = useState('');
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { city: '' },
  });

  function onSubmit(values: FormValues) {
    setCity(values.city);
  }

  return (
    <main className="bg-surface text-text p-page">
      <h1 className="text-text">Weather-driven activity rankings</h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 flex items-end gap-3">
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. London" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit">Rank activities</Button>
        </form>
      </Form>

      {city && (
        <ErrorBoundary key={city}>
          <Suspense fallback={<RankingSkeleton />}>
            <CityRankings city={city} />
          </Suspense>
        </ErrorBoundary>
      )}
    </main>
  );
}

export default App;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec nx test-ci weather-app -- home.spec`
Expected: PASS (3 tests). If `@testing-library/user-event` is missing, install it dev-only: `pnpm add -D --filter @collinson/weather-app @testing-library/user-event` (apply guardrail fix if blocked) and re-run.

- [ ] **Step 5: Full verification**

Run:
```bash
pnpm codegen && pnpm exec nx typecheck weather-app && pnpm exec nx lint weather-app && pnpm exec nx test-ci weather-app
```
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/weather-app/app/routes/home.tsx apps/weather-app/tests/routes/home.spec.tsx apps/weather-app/package.json pnpm-lock.yaml
git rm apps/weather-app/tests/routes/_index.spec.tsx
git commit -m "feat(weather-app): city ranking form on home route wired to graphql"
```

---

## Manual smoke test (after all tasks)

1. Terminal A: `pnpm exec nx serve weather-bff` (or the BFF's run target) — confirm "weather-bff ready at http://localhost:4000/".
2. Terminal B: `pnpm exec nx dev weather-app` — open http://localhost:4200.
3. Enter "London", submit → skeleton, then ranked activities with per-day scores.
4. Submit empty → "Enter a city" validation message, no request.
5. Enter a nonsense city → error message from the boundary.
6. Re-submit "London" → instant (served from the TanStack cache).

## Notes / trade-offs (for the README)

- Frontend types are generated from the BFF SDL (`domain types → SDL → generated types`); regenerate with `pnpm codegen` after any schema change. The generated dir is committed.
- No shared contract lib: codegen makes it unnecessary and keeps `typeDefs` server-owned.
- SPA client-side suspense (no SSR/loader), per the existing app config.
- `graphql-request` throws on GraphQL `errors[]`, so the `ErrorBoundary` surfaces `CityNotFound`/`InvalidInput` messages without extra handling.
