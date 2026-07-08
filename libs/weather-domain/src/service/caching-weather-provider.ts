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
