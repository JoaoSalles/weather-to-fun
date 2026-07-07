import type { ActivityScorer } from './activity-scorer';
import type { DailyWeather } from '../weather.types';
import { clampScore } from './score-utils';

function windScore(w: number): number {
  if (w < 5) return 0;
  if (w <= 20) return ((w - 5) / 15) * 70; // 0..70
  if (w <= 35) return 70 + ((w - 20) / 15) * 30; // 70..100
  if (w <= 60) return Math.max(100 - ((w - 35) / 25) * 100, 0); // 100..0
  return 0;
}

function tempFactor(tempMaxC: number): number {
  if (tempMaxC >= 15 && tempMaxC <= 30) return 1;
  if (tempMaxC < 10 || tempMaxC > 35) return 0.3;
  return 0.7;
}

export const surfingScorer: ActivityScorer = {
  activity: 'SURFING',
  scoreDay(day: DailyWeather): number {
    return clampScore(windScore(day.windSpeedMax) * tempFactor(day.tempMaxC));
  },
};
