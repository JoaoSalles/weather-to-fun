import type { ActivityScorer } from './activity-scorer';
import type { DailyWeather } from '../weather.types';
import { clampScore } from './score-utils';

// WMO weather_code -> 0..100 "how clear/pleasant the sky is".
export function skyClearness(weatherCode: number): number {
  if (weatherCode === 0) return 100;
  if (weatherCode === 1) return 90;
  if (weatherCode === 2) return 70;
  if (weatherCode === 3) return 50;
  if (weatherCode === 45 || weatherCode === 48) return 30;
  if (weatherCode >= 51 && weatherCode <= 67) return 20; // drizzle/rain
  if (weatherCode >= 71 && weatherCode <= 77) return 20; // snow
  if (weatherCode >= 80 && weatherCode <= 82) return 15; // showers
  if (weatherCode >= 95) return 0; // thunderstorm
  return 25;
}

export const outdoorSightseeingScorer: ActivityScorer = {
  activity: 'OUTDOOR_SIGHTSEEING',
  scoreDay(day: DailyWeather): number {
    const avgTemp = (day.tempMaxC + day.tempMinC) / 2;
    const tempComfort = 1 - Math.min(Math.abs(avgTemp - 20) / 20, 1); // 0..1
    const precipPenalty = (day.precipitationProbabilityMax / 100) * 30;
    const windPenalty = Math.min(day.windSpeedMax / 60, 1) * 15;
    return clampScore(
      skyClearness(day.weatherCode) * 0.5 +
        tempComfort * 50 -
        precipPenalty -
        windPenalty,
    );
  },
};
