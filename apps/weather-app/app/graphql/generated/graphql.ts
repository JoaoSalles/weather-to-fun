/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Activity =
  | 'INDOOR_SIGHTSEEING'
  | 'OUTDOOR_SIGHTSEEING'
  | 'SKIING'
  | 'SURFING';

export type RankActivitiesQueryVariables = Exact<{
  city: string;
}>;


export type RankActivitiesQuery = { rankActivities: { location: { name: string, admin1: string | null, country: string | null, latitude: number, longitude: number, timezone: string }, rankings: Array<{ activity: Activity, overallScore: number, daily: Array<{ date: string, score: number, weather: { date: string, weatherCode: number, tempMaxC: number, tempMinC: number, rainMm: number, snowfallCm: number, windSpeedMax: number, windGustsMax: number, windDirectionDominant: number, precipitationProbabilityMax: number } }> }> } };


export const RankActivitiesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"RankActivities"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"city"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rankActivities"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"city"},"value":{"kind":"Variable","name":{"kind":"Name","value":"city"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"location"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"admin1"}},{"kind":"Field","name":{"kind":"Name","value":"country"}},{"kind":"Field","name":{"kind":"Name","value":"latitude"}},{"kind":"Field","name":{"kind":"Name","value":"longitude"}},{"kind":"Field","name":{"kind":"Name","value":"timezone"}}]}},{"kind":"Field","name":{"kind":"Name","value":"rankings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"activity"}},{"kind":"Field","name":{"kind":"Name","value":"overallScore"}},{"kind":"Field","name":{"kind":"Name","value":"daily"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"weather"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"weatherCode"}},{"kind":"Field","name":{"kind":"Name","value":"tempMaxC"}},{"kind":"Field","name":{"kind":"Name","value":"tempMinC"}},{"kind":"Field","name":{"kind":"Name","value":"rainMm"}},{"kind":"Field","name":{"kind":"Name","value":"snowfallCm"}},{"kind":"Field","name":{"kind":"Name","value":"windSpeedMax"}},{"kind":"Field","name":{"kind":"Name","value":"windGustsMax"}},{"kind":"Field","name":{"kind":"Name","value":"windDirectionDominant"}},{"kind":"Field","name":{"kind":"Name","value":"precipitationProbabilityMax"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<RankActivitiesQuery, RankActivitiesQueryVariables>;