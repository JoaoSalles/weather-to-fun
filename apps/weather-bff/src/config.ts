export const config = {
  port: Number(process.env['PORT'] ?? 4000),
  geocodingBaseUrl:
    process.env['OPEN_METEO_GEOCODING_URL'] ?? 'https://geocoding-api.open-meteo.com/v1/search',
  forecastBaseUrl:
    process.env['OPEN_METEO_FORECAST_URL'] ?? 'https://api.open-meteo.com/v1/forecast',
};
