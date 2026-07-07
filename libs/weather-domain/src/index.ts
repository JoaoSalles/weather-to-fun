export type {
  Activity,
  DailyWeather,
  Location,
  Forecast,
  DailyScore,
  ActivityRanking,
  CityRanking,
} from './domain/weather.types';
export { CityNotFoundError, UpstreamError, InvalidInputError } from './domain/errors';
export { rankActivities } from './domain/rank-activities';
export { scorers } from './domain/scoring/registry';
export type { ActivityScorer } from './domain/scoring/activity-scorer';
export { OpenMeteoClient } from './integration/open-meteo.client';
export type { OpenMeteoClientOptions } from './integration/open-meteo.client';
export {
  WeatherRankingService,
  type WeatherProvider,
} from './service/weather-ranking.service';
