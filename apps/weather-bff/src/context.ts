import { OpenMeteoClient, WeatherRankingService } from '@collinson/weather-domain';
import { config } from './config';
import type { GraphQLContext } from './graphql/resolvers';

export function buildContext(): GraphQLContext {
  const client = new OpenMeteoClient({
    geocodingBaseUrl: config.geocodingBaseUrl,
    forecastBaseUrl: config.forecastBaseUrl,
  });
  return { service: new WeatherRankingService(client) };
}
