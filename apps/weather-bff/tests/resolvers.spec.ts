import { describe, it, expect } from 'vitest';
import { ApolloServer } from '@apollo/server';
import { typeDefs } from '../src/graphql/schema';
import { resolvers, type GraphQLContext } from '../src/graphql/resolvers';
import { CityNotFoundError, type CityRanking } from '@collinson/weather-domain';

const ranking: CityRanking = {
  location: { name: 'Lisbon', country: 'Portugal', latitude: 38.7, longitude: -9.1, timezone: 'Europe/Lisbon' },
  rankings: [
    { activity: 'OUTDOOR_SIGHTSEEING', overallScore: 88, daily: [
      { date: '2026-07-07', score: 88, weather: {
        date: '2026-07-07', weatherCode: 0, tempMaxC: 26, tempMinC: 18, rainMm: 0, snowfallCm: 0,
        windSpeedMax: 12, windGustsMax: 20, windDirectionDominant: 300, precipitationProbabilityMax: 5 } },
    ] },
    { activity: 'SURFING', overallScore: 60, daily: [] },
    { activity: 'INDOOR_SIGHTSEEING', overallScore: 20, daily: [] },
    { activity: 'SKIING', overallScore: 0, daily: [] },
  ],
};

const QUERY = `
  query Rank($city: String!) {
    rankActivities(city: $city) {
      location { name country }
      rankings { activity overallScore daily { date score weather { weatherCode tempMaxC } } }
    }
  }
`;

function server(service: GraphQLContext['service']) {
  const apollo = new ApolloServer<GraphQLContext>({ typeDefs, resolvers });
  return { apollo, contextValue: { service } };
}

describe('rankActivities resolver', () => {
  it('returns the ranking for a city', async () => {
    const { apollo, contextValue } = server({ rankForCity: async () => ranking });
    const res = await apollo.executeOperation(
      { query: QUERY, variables: { city: 'Lisbon' } },
      { contextValue },
    );
    expect(res.body.kind).toBe('single');
    if (res.body.kind !== 'single') throw new Error('unexpected');
    expect(res.body.singleResult.errors).toBeUndefined();
    const data = res.body.singleResult.data?.['rankActivities'] as {
      location: { name: string };
      rankings: { activity: string; daily: { weather: { weatherCode: number } }[] }[];
    };
    expect(data.location.name).toBe('Lisbon');
    expect(data.rankings[0].activity).toBe('OUTDOOR_SIGHTSEEING');
    expect(data.rankings[0].daily[0].weather.weatherCode).toBe(0);
  });

  it('surfaces CityNotFoundError as a CITY_NOT_FOUND GraphQL error', async () => {
    const { apollo, contextValue } = server({
      rankForCity: async () => { throw new CityNotFoundError('zzz'); },
    });
    const res = await apollo.executeOperation(
      { query: QUERY, variables: { city: 'zzz' } },
      { contextValue },
    );
    if (res.body.kind !== 'single') throw new Error('unexpected');
    expect(res.body.singleResult.errors?.[0].extensions?.['code']).toBe('CITY_NOT_FOUND');
  });
});
