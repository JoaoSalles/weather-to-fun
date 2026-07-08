import { describe, it, expect } from 'vitest';
import { composeServices } from '../src/composition';
import type { Config } from '../src/config';

const baseConfig: Config = {
  port: 4000,
  geocodingBaseUrl: 'http://localhost/geo',
  forecastBaseUrl: 'http://localhost/forecast',
  redisUrl: undefined,
  geocodeTtlSeconds: 100,
  forecastTtlSeconds: 10,
  upstreamTimeoutMs: 5000,
  upstreamMaxRetries: 2,
};

// not useful but i will keep the structure for future tests that may need to test redis enabled scenarios
describe('composeServices', () => {
  it('builds a service and a shutdown hook when Redis is disabled', async () => {
    const services = await composeServices(baseConfig);
    expect(typeof services.service.rankForCity).toBe('function');
    await expect(services.shutdown()).resolves.toBeUndefined();
  });
});
