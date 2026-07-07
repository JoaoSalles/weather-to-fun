import { request } from 'graphql-request';
import { RANK_ACTIVITIES } from './operations';

export const GQL_URL: string =
  import.meta.env.VITE_GRAPHQL_URL ?? 'http://localhost:4000/';

export async function rankActivities(city: string) {
  const data = await request(GQL_URL, RANK_ACTIVITIES, { city });
  return data.rankActivities;
}
