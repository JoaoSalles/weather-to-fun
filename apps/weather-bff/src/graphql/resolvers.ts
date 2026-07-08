import { GraphQLError } from 'graphql';
import {
  CityNotFoundError,
  InvalidInputError,
  UpstreamError,
  type CityRanking,
  type WeatherRankingService,
} from '@collinson/weather-domain';

export interface GraphQLContext {
  weatherService: Pick<WeatherRankingService, 'rankForCity'>;
}

function toGraphQLError(error: unknown): GraphQLError {
  if (
    error instanceof CityNotFoundError ||
    error instanceof InvalidInputError ||
    error instanceof UpstreamError
  ) {
    return new GraphQLError(error.message, { extensions: { code: error.code } });
  }
  return new GraphQLError('Unexpected error', { extensions: { code: 'INTERNAL_SERVER_ERROR' } });
}

export const resolvers = {
  Query: {
    rankActivities: async (
      _parent: unknown,
      args: { city: string },
      context: GraphQLContext,
    ): Promise<CityRanking> => {
      try {
        return await context.weatherService.rankForCity(args.city);
      } catch (error) {
        throw toGraphQLError(error);
      }
    },
  },
};
