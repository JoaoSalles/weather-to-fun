import {
  OpenMeteoClient,
  CachingWeatherProvider,
  WeatherRankingService,
  type Cache,
} from '@collinson/weather-domain';
import type { Config } from './config';

export interface Services {
  weatherService: WeatherRankingService;
}

/**
 * Composition root: builds the domain graph from config and a cache backend.
 * Infrastructure lifecycle (e.g. the Redis connection) is owned by the caller
 * (see `main.ts` / `cache/redis-client.ts`), not here.
 */
export function composeServices(config: Config, cache: Cache): Services {
  const client = new OpenMeteoClient({
    geocodingBaseUrl: config.geocodingBaseUrl,
    forecastBaseUrl: config.forecastBaseUrl,
    timeoutMs: config.upstreamTimeoutMs,
    maxRetries: config.upstreamMaxRetries,
  });
  // Decorate the upstream client with caching, so the service can be used without
  // worrying about cache misses or stampedes. The cache backend is injected from
  // the caller, so it can be a no-op in dev/test or Redis in production.
  const provider = new CachingWeatherProvider(client, cache, {
    geocodeSeconds: config.geocodeTtlSeconds,
    forecastSeconds: config.forecastTtlSeconds,
  });
  const weatherService = new WeatherRankingService(provider);

  return { weatherService };
}
