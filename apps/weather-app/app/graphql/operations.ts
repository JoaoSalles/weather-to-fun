import { graphql } from './generated';

export const RANK_ACTIVITIES = graphql(`
  query RankActivities(
    $city: String!
    $includeLocationDetails: Boolean = true
    $includeWeather: Boolean = true
  ) {
    rankActivities(city: $city) {
      location {
        name
        admin1 @include(if: $includeLocationDetails)
        country @include(if: $includeLocationDetails)
        latitude @include(if: $includeLocationDetails)
        longitude @include(if: $includeLocationDetails)
        timezone @include(if: $includeLocationDetails)
      }
      rankings {
        activity
        overallScore
        daily {
          date
          score
          weather @include(if: $includeWeather) {
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

export const GET_LOCATION_NAME = graphql(`
  query GetLocationName($city: String!) {
    rankActivities(city: $city) {
      location {
        name
      }
    }
  }
`);
