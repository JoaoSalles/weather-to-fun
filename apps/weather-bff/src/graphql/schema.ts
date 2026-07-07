export const typeDefs = /* GraphQL */ `
  enum Activity {
    SKIING
    SURFING
    OUTDOOR_SIGHTSEEING
    INDOOR_SIGHTSEEING
  }

  type Location {
    name: String!
    admin1: String
    country: String
    latitude: Float!
    longitude: Float!
    timezone: String!
  }

  type DailyWeather {
    date: String!
    weatherCode: Int!
    tempMaxC: Float!
    tempMinC: Float!
    rainMm: Float!
    snowfallCm: Float!
    windSpeedMax: Float!
    windGustsMax: Float!
    windDirectionDominant: Int!
    precipitationProbabilityMax: Int!
  }

  type DailyScore {
    date: String!
    score: Int!
    weather: DailyWeather!
  }

  type ActivityRanking {
    activity: Activity!
    overallScore: Int!
    daily: [DailyScore!]!
  }

  type CityRanking {
    location: Location!
    rankings: [ActivityRanking!]!
  }

  type Query {
    rankActivities(city: String!): CityRanking!
  }
`;
