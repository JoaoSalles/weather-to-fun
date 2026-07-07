import { describe, it, expect } from 'vitest';
import { surfingScorer } from './surfing.scorer';
import type { DailyWeather } from '../weather.types';

const base: DailyWeather = {
  date: '2026-07-07', weatherCode: 2, tempMaxC: 24, tempMinC: 18,
  rainMm: 0, snowfallCm: 0, windSpeedMax: 26, windGustsMax: 34,
  windDirectionDominant: 200, precipitationProbabilityMax: 10,
};

describe('surfingScorer', () => {
  it('is SURFING', () => expect(surfingScorer.activity).toBe('SURFING'));

  it('scores a mild day with good wind highly', () => {
    expect(surfingScorer.scoreDay(base)).toBeGreaterThanOrEqual(80);
  });

  it('scores a flat-calm day low', () => {
    const calm: DailyWeather = { ...base, windSpeedMax: 2, windGustsMax: 4 };
    expect(surfingScorer.scoreDay(calm)).toBeLessThanOrEqual(10);
  });

  it('reduces score on a freezing day even with good wind', () => {
    const cold: DailyWeather = { ...base, tempMaxC: 2 };
    expect(surfingScorer.scoreDay(cold)).toBeLessThan(surfingScorer.scoreDay(base));
  });
});
