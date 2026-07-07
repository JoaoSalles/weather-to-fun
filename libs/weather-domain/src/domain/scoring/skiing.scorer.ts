import type { ActivityScorer } from './activity-scorer';
import type { DailyWeather } from '../weather.types';
import { clampScore } from './score-utils';

export const skiingScorer: ActivityScorer = {
  activity: 'SKIING',
  scoreDay(day: DailyWeather): number {
    const snow = Math.min(day.snowfallCm / 5, 1) * 60; // 60 points for 5cm or more of snow
    const cold = Math.min(Math.max((10 - day.tempMaxC) / 10, 0), 1) * 40; // 40 points for temperatures below 10°C
    const rainPenalty = Math.min(day.rainMm / 10, 1) * 30; // 30 points penalty for 10mm or more of rain
    const windPenalty =
      day.windSpeedMax > 40 ? Math.min((day.windSpeedMax - 40) / 40, 1) * 20 : 0; // 20 points penalty for wind speeds above 40 km/h
    return clampScore(snow + cold - rainPenalty - windPenalty);
  },
};
