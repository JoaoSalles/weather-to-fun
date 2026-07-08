export const config = {
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
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
  // Comma-separated allowed CORS origins; '*' allows any (default for local dev).
  corsOrigins: process.env['CORS_ORIGINS'] ?? '*',
  // Max GraphQL query nesting depth; rejects abusive deeply-nested documents.
  maxQueryDepth: Number(process.env['MAX_QUERY_DEPTH'] ?? 8),
  // Max request body size accepted by the /graphql endpoint.
  bodyLimit: process.env['BODY_LIMIT'] ?? '16kb',
};

export type Config = typeof config;

export const isProduction = (c: Config): boolean => c.nodeEnv === 'production';
