import type { ActivityScorer } from './activity-scorer';
import { skiingScorer } from './skiing.scorer';
import { surfingScorer } from './surfing.scorer';
import { outdoorSightseeingScorer } from './outdoor-sightseeing.scorer';
import { indoorSightseeingScorer } from './indoor-sightseeing.scorer';

// Add a new activity by adding its scorer here (and the Activity union).
export const scorers: ActivityScorer[] = [
  skiingScorer,
  surfingScorer,
  outdoorSightseeingScorer,
  indoorSightseeingScorer,
];
