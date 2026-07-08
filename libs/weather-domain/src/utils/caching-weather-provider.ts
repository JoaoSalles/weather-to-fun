import type { Cache } from '../cache/cache.port';
import type { Location, Forecast } from '../domain/weather.types';
import type { WeatherProvider } from '../service/weather-ranking.service';
import { SingleFlight } from './single-flight';

export interface CacheTtls {
  geocodeSeconds: number;
  forecastSeconds: number;
}

/** Decorates a WeatherProvider, caching geocode and forecast results per call. */
export class CachingWeatherProvider implements WeatherProvider {
  private readonly single = new SingleFlight();

  constructor(
    private readonly inner: WeatherProvider,
    private readonly cache: Cache,
    private readonly ttls: CacheTtls,
  ) {}

  async geocode(city: string): Promise<Location> {
    const key = `geocode:${city.trim().toLowerCase()}`;
    // Single-flight the whole read-through so concurrent misses share one
    // upstream call (cache-stampede prevention). The cache read stays inside so
    // late-joining callers still observe the value the leader just wrote.
    return this.single.run(key, async () => {
      const cached = await this.cache.get<Location>(key);
      if (cached) return cached;
      const location = await this.inner.geocode(city);
      await this.cache.set(key, location, this.ttls.geocodeSeconds);
      return location;
    });
  }

  async fetchForecast(location: Location): Promise<Forecast> {
    const key = `forecast:${location.latitude.toFixed(2)}:${location.longitude.toFixed(2)}`;
    return this.single.run(key, async () => {
      const cached = await this.cache.get<Forecast>(key);
      if (cached) return cached;
      const forecast = await this.inner.fetchForecast(location);
      await this.cache.set(key, forecast, this.ttls.forecastSeconds);
      return forecast;
    });
  }
}
