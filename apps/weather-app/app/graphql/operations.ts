import { graphql } from './generated';

export const RANK_ACTIVITIES = graphql(`
  query RankActivities($city: String!) {
    rankActivities(city: $city) {
      location {
        name
        admin1
        country
        latitude
        longitude
        timezone
      }
      rankings {
        activity
        overallScore
        daily {
          date
          score
          weather {
            date
            weatherCode
            tempMaxC
            tempMinC
            rainMm
            snowfallCm
            windSpeedMax
            windGustsMax
            windDirectionDominant
            precipitationProbabilityMax
          }
        }
      }
    }
  }
`);
