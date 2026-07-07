import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import App from '../../app/routes/home';

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
    rankActivitiesMock.mockResolvedValueOnce(sample);
    renderApp();
    await userEvent.type(screen.getByLabelText(/city/i), 'London');
    await userEvent.click(screen.getByRole('button', { name: /rank activities/i }));
    expect(await screen.findByText(/London/)).toBeTruthy();
    expect(screen.getByText('SURFING')).toBeTruthy();
    expect(rankActivitiesMock).toHaveBeenCalledWith('London');
  });

  it('renders the error message when the query fails', async () => {
    rankActivitiesMock.mockRejectedValueOnce(new Error('City not found'));
    renderApp();
    await userEvent.type(screen.getByLabelText(/city/i), 'Nowhere');
    await userEvent.click(screen.getByRole('button', { name: /rank activities/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('Something went wrong while fetching the rankings. Please try again later.'),
    );
  });
});
