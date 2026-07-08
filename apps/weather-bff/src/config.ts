export const config = {
  port: Number(process.env['PORT'] ?? 4000),
  geocodingBaseUrl:
    process.env['OPEN_METEO_GEOCODING_URL'] ?? 'https://geocoding-api.open-meteo.com/v1/search',
  forecastBaseUrl:
    process.env['OPEN_METEO_FORECAST_URL'] ?? 'https://api.open-meteo.com/v1/forecast',
  redisUrl: process.env['REDIS_URL'],
  geocodeTtlSeconds: Number(process.env['GEOCODE_TTL_SECONDS'] ?? 2_592_000), // 30 days
  forecastTtlSeconds: Number(process.env['FORECAST_TTL_SECONDS'] ?? 3600), // 1 hour
  upstreamTimeoutMs: Number(process.env['UPSTREAM_TIMEOUT_MS'] ?? 5000),
  upstreamMaxRetries: Number(process.env['UPSTREAM_MAX_RETRIES'] ?? 2),
};

export type Config = typeof config;
