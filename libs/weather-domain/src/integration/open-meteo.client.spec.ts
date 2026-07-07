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
    // 1783382400 = 2026-07-07T00:00:00Z; with utc_offset_seconds 0 -> 2026-07-07
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
      date: '2026-07-07', weatherCode: 51, tempMaxC: 20.4, tempMinC: 13.4,
      rainMm: 1.1, snowfallCm: 0, windSpeedMax: 12.8, windGustsMax: 36.7,
      windDirectionDominant: 258, precipitationProbabilityMax: 78,
    });
    const url = String(fetchFn.mock.calls[0][0]);
    expect(url).toContain('latitude=-23.5475');
    expect(url).toContain('timeformat=unixtime');
    expect(url).toContain('timezone=auto');
  });
});
