import type { CityRanking, Forecast } from './weather.types';
import { clampScore } from './scoring/score-utils';
import { scorers } from './scoring/registry';

export function rankActivities(forecast: Forecast): CityRanking {
  const rankings = scorers
    .map((scorer) => {
      const daily = forecast.days.map((weather) => ({
        date: weather.date,
        score: clampScore(scorer.scoreDay(weather)),
        weather,
      }));
      const overallScore = Math.round(
        daily.reduce((sum, d) => sum + d.score, 0) / daily.length,
      );
      return { activity: scorer.activity, overallScore, daily };
    })
    .sort((a, b) => b.overallScore - a.overallScore);

  return { location: forecast.location, rankings };
}
