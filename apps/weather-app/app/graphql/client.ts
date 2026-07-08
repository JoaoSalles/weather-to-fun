import { request } from 'graphql-request';
import { RANK_ACTIVITIES, GET_LOCATION_NAME } from './operations';

export const GQL_URL: string =
  import.meta.env.VITE_GRAPHQL_URL ?? 'http://localhost:4000/';

export interface RankActivitiesOptions {
  /** Include admin1/country/lat/long/timezone on the location (default true). */
  includeLocationDetails?: boolean;
  /** Include the per-day weather payload on each ranking (default true). */
  includeWeather?: boolean;
}

export async function rankActivities(
  city: string,
  options?: RankActivitiesOptions,
) {
  const data = await request(GQL_URL, RANK_ACTIVITIES, { city, ...options });
  return data.rankActivities;
}

/** Lightweight lookup that resolves only the location name for a city. */
export async function getLocationName(city: string) {
  const data = await request(GQL_URL, GET_LOCATION_NAME, { city });
  return data.rankActivities.location;
}
