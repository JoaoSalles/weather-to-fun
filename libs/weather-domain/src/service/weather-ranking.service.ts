import type { CityRanking, Forecast, Location } from '../domain/weather.types';
import { InvalidInputError } from '../domain/errors';
import { rankActivities } from '../domain/rank-activities';

export interface WeatherProvider {
  geocode(city: string): Promise<Location>;
  fetchForecast(location: Location): Promise<Forecast>;
}

export class WeatherRankingService {
  constructor(private readonly provider: WeatherProvider) {}

  async rankForCity(city: string): Promise<CityRanking> {
    const trimmed = city.trim();
    if (!trimmed) throw new InvalidInputError('city must not be empty');
    const location = await this.provider.geocode(trimmed);
    const forecast = await this.provider.fetchForecast(location);
    return rankActivities(forecast);
  }
}
