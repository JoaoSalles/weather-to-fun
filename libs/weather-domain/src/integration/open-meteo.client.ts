import type { DailyWeather, Forecast, Location } from '../domain/weather.types';
import { CityNotFoundError, UpstreamError } from '../domain/errors';

export type FetchFn = typeof globalThis.fetch;

export interface OpenMeteoClientOptions {
  fetchFn?: FetchFn;
  geocodingBaseUrl?: string;
  forecastBaseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BASE_DELAY_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const DAILY_VARS = [
  'temperature_2m_max',
  'temperature_2m_min',
  'rain_sum',
  'snowfall_sum',
  'wind_speed_10m_max',
  'wind_direction_10m_dominant',
  'wind_gusts_10m_max',
  'weather_code',
  'precipitation_probability_max',
].join(',');

interface GeocodingResult {
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

interface ForecastResponse {
  utc_offset_seconds: number;
  daily: {
    time: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    rain_sum: number[];
    snowfall_sum: number[];
    wind_speed_10m_max: number[];
    wind_direction_10m_dominant: number[];
    wind_gusts_10m_max: number[];
    weather_code: number[];
    precipitation_probability_max: number[];
  };
}

function unixToIsoDate(unixSeconds: number, utcOffsetSeconds: number): string {
  return new Date((unixSeconds + utcOffsetSeconds) * 1000).toISOString().slice(0, 10);
}

export class OpenMeteoClient {
  private readonly fetchFn: FetchFn;
  private readonly geocodingBaseUrl: string;
  private readonly forecastBaseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;

  constructor(options: OpenMeteoClientOptions = {}) {
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
    this.geocodingBaseUrl =
      options.geocodingBaseUrl ?? 'https://geocoding-api.open-meteo.com/v1/search';
    this.forecastBaseUrl =
      options.forecastBaseUrl ?? 'https://api.open-meteo.com/v1/forecast';
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
  }

  async geocode(city: string): Promise<Location> {
    const url = new URL(this.geocodingBaseUrl);
    url.searchParams.set('name', city);
    url.searchParams.set('count', '1');

    const body = await this.getJson<{ results?: GeocodingResult[] }>(url);
    const first = body.results?.[0];
    if (!first) throw new CityNotFoundError(city);

    return {
      name: first.name,
      admin1: first.admin1,
      country: first.country,
      latitude: first.latitude,
      longitude: first.longitude,
      timezone: first.timezone,
    };
  }

  async fetchForecast(location: Location): Promise<Forecast> {
    const url = new URL(this.forecastBaseUrl);
    url.searchParams.set('latitude', String(location.latitude));
    url.searchParams.set('longitude', String(location.longitude));
    url.searchParams.set('daily', DAILY_VARS);
    url.searchParams.set('timeformat', 'unixtime');
    url.searchParams.set('format', 'json');
    url.searchParams.set('timezone', 'auto');

    const body = await this.getJson<ForecastResponse>(url);
    const d = body.daily;
    const days: DailyWeather[] = d.time.map((time, i) => ({
      date: unixToIsoDate(time, body.utc_offset_seconds),
      weatherCode: d.weather_code[i],
      tempMaxC: d.temperature_2m_max[i],
      tempMinC: d.temperature_2m_min[i],
      rainMm: d.rain_sum[i],
      snowfallCm: d.snowfall_sum[i],
      windSpeedMax: d.wind_speed_10m_max[i],
      windGustsMax: d.wind_gusts_10m_max[i],
      windDirectionDominant: d.wind_direction_10m_dominant[i],
      precipitationProbabilityMax: d.precipitation_probability_max[i],
    }));

    return { location, days };
  }

  private async getJson<T>(url: URL): Promise<T> {
    let lastError = 'unknown error';

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        await sleep(this.retryBaseDelayMs * 2 ** (attempt - 1));
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchFn(url, { signal: controller.signal });
        if (response.ok) {
          return (await response.json()) as T;
        }
        // 4xx: caller error — do not retry.
        if (response.status < 500) {
          throw new UpstreamError(`Open-Meteo responded with status ${response.status}`);
        }
        // 5xx: retryable.
        lastError = `status ${response.status}`;
      } catch (cause) {
        if (cause instanceof UpstreamError) throw cause; // non-retryable 4xx
        lastError = String(cause);
      } finally {
        clearTimeout(timer);
      }
    }

    throw new UpstreamError(`Open-Meteo request failed after retries: ${lastError}`);
  }
}
