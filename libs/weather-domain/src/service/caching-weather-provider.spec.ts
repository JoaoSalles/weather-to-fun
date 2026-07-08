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
