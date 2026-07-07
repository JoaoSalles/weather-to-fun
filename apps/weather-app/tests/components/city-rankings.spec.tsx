import { Suspense } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { CityRankings } from '../../app/components/city-rankings';

const { rankActivitiesMock } = vi.hoisted(() => ({ rankActivitiesMock: vi.fn() }));
vi.mock('../../app/graphql/client', () => ({ rankActivities: rankActivitiesMock }));

const sample = {
  location: {
    name: 'London',
    admin1: null,
    country: 'United Kingdom',
    latitude: 51.5,
    longitude: -0.1,
    timezone: 'Europe/London',
  },
  rankings: [
    {
      activity: 'INDOOR_SIGHTSEEING',
      overallScore: 82,
      daily: [
        {
          date: '2026-07-07',
          score: 80,
          weather: {
            date: '2026-07-07',
            weatherCode: 3,
            tempMaxC: 20,
            tempMinC: 12,
            rainMm: 1,
            snowfallCm: 0,
            windSpeedMax: 15,
            windGustsMax: 25,
            windDirectionDominant: 180,
            precipitationProbabilityMax: 40,
          },
        },
      ],
    },
    {
      activity: 'SURFING',
      overallScore: 64,
      daily: [
        {
          date: '2026-07-07',
          score: 60,
          weather: {
            date: '2026-07-07',
            weatherCode: 3,
            tempMaxC: 20,
            tempMinC: 12,
            rainMm: 1,
            snowfallCm: 0,
            windSpeedMax: 15,
            windGustsMax: 25,
            windDirectionDominant: 180,
            precipitationProbabilityMax: 40,
          },
        },
      ],
    },
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
    rankActivitiesMock.mockResolvedValueOnce(sample);
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
    rankActivitiesMock.mockResolvedValueOnce(sample);
    renderWithClient(<CityRankings city="Paris" />);
    await screen.findByText(/London/);
    expect(rankActivitiesMock).toHaveBeenCalledWith('Paris');
  });
});
