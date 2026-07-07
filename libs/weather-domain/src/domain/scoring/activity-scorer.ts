import type { Activity, DailyWeather } from '../weather.types';

export interface ActivityScorer {
  readonly activity: Activity;
  scoreDay(day: DailyWeather): number; // 0..100
}
