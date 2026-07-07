import type { ActivityScorer } from './activity-scorer';
import type { DailyWeather } from '../weather.types';
import { clampScore } from './score-utils';
import { outdoorSightseeingScorer } from './outdoor-sightseeing.scorer';

export const indoorSightseeingScorer: ActivityScorer = {
  activity: 'INDOOR_SIGHTSEEING',
  scoreDay(day: DailyWeather): number {
    return clampScore(100 - outdoorSightseeingScorer.scoreDay(day));
  },
};
