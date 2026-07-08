import { createClient } from 'redis';
import {
  OpenMeteoClient,
  CachingWeatherProvider,
  WeatherRankingService,
  NoopCache,
  type Cache,
} from '@collinson/weather-domain';
import { RedisCache } from './cache/redis-cache';
import type { Config } from './config';

export interface Services {
  service: WeatherRankingService;
  shutdown: () => Promise<void>;
}

/** Composition root: builds long-lived dependencies once at startup. */
export async function composeServices(config: Config): Promise<Services> {
  let cache: Cache = new NoopCache();
  let shutdown = async (): Promise<void> => {
    /* nothing to clean up when Redis is disabled */
  };

  if (config.redisUrl) {
    const redis = createClient({ url: config.redisUrl });
    redis.on('error', (err) => console.warn(`Redis client error: ${String(err)}`));
    await redis.connect();
    cache = new RedisCache(redis);
    shutdown = async () => {
      await redis.quit();
    };
  }

  const client = new OpenMeteoClient({
    geocodingBaseUrl: config.geocodingBaseUrl,
    forecastBaseUrl: config.forecastBaseUrl,
    timeoutMs: config.upstreamTimeoutMs,
    maxRetries: config.upstreamMaxRetries,
  });
  const provider = new CachingWeatherProvider(client, cache, {
    geocodeSeconds: config.geocodeTtlSeconds,
    forecastSeconds: config.forecastTtlSeconds,
  });
  const service = new WeatherRankingService(provider);

  return { service, shutdown };
}
