import { describe, it, expect } from 'vitest';
import { NoopCache } from '@collinson/weather-domain';
import { composeServices } from '../src/composition';
import type { Config } from '../src/config';

const baseConfig: Config = {
  nodeEnv: 'test',
  port: 4000,
  geocodingBaseUrl: 'http://localhost/geo',
  forecastBaseUrl: 'http://localhost/forecast',
  redisUrl: undefined,
  geocodeTtlSeconds: 100,
  forecastTtlSeconds: 10,
  upstreamTimeoutMs: 5000,
  upstreamMaxRetries: 2,
  corsOrigins: '*',
  maxQueryDepth: 8,
  bodyLimit: '16kb',
};

describe('composeServices', () => {
  it('builds a weather service from config and a cache backend', () => {
    const { weatherService } = composeServices(baseConfig, new NoopCache());
    expect(typeof weatherService.rankForCity).toBe('function');
  });
});
