import { describe, it, expect } from 'vitest';
import { rankActivities } from './rank-activities';
import type { Forecast, DailyWeather } from './weather.types';

function day(partial: Partial<DailyWeather>): DailyWeather {
  return {
    date: '2026-07-07', weatherCode: 0, tempMaxC: 22, tempMinC: 16,
    rainMm: 0, snowfallCm: 0, windSpeedMax: 8, windGustsMax: 12,
    windDirectionDominant: 180, precipitationProbabilityMax: 5, ...partial,
  };
}

const forecast: Forecast = {
  location: { name: 'Testville', latitude: 1, longitude: 2, timezone: 'GMT' },
  days: [day({ date: '2026-07-07' }), day({ date: '2026-07-08', tempMaxC: 24 })],
};

describe('rankActivities', () => {
  it('returns one ranking per activity, each with per-day detail', () => {
    const result = rankActivities(forecast);
    expect(result.rankings).toHaveLength(4);
    for (const r of result.rankings) {
      expect(r.daily).toHaveLength(2);
      expect(r.daily[0].weather.date).toBe('2026-07-07');
    }
  });

  it('sorts rankings by overallScore descending', () => {
    const scores = rankActivities(forecast).rankings.map((r) => r.overallScore);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('ranks outdoor sightseeing top on clear mild days', () => {
    expect(rankActivities(forecast).rankings[0].activity).toBe('OUTDOOR_SIGHTSEEING');
  });

  it('computes overallScore as the rounded mean of daily scores', () => {
    const r = rankActivities(forecast).rankings.find((x) => x.activity === 'SKIING');
    if (!r) throw new Error('expected a SKIING ranking');
    const mean = Math.round(r.daily.reduce((a, d) => a + d.score, 0) / r.daily.length);
    expect(r.overallScore).toBe(mean);
  });
});
