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
