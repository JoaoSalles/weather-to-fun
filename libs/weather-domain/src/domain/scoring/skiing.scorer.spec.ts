import { describe, it, expect } from 'vitest';
import { skiingScorer } from './skiing.scorer';
import type { DailyWeather } from '../weather.types';

const base: DailyWeather = {
  date: '2026-07-07', weatherCode: 71, tempMaxC: -3, tempMinC: -10,
  rainMm: 0, snowfallCm: 8, windSpeedMax: 10, windGustsMax: 20,
  windDirectionDominant: 180, precipitationProbabilityMax: 90,
};

describe('skiingScorer', () => {
  it('is SKIING', () => expect(skiingScorer.activity).toBe('SKIING'));

  it('scores a cold, snowy, calm day highly', () => {
    expect(skiingScorer.scoreDay(base)).toBeGreaterThanOrEqual(85);
  });

  it('scores a warm, rainy, snowless day near zero', () => {
    const warm: DailyWeather = { ...base, tempMaxC: 18, snowfallCm: 0, rainMm: 12, weatherCode: 61 };
    expect(skiingScorer.scoreDay(warm)).toBeLessThanOrEqual(5);
  });

  it('penalizes very strong wind', () => {
    const windy: DailyWeather = { ...base, windSpeedMax: 80 };
    expect(skiingScorer.scoreDay(windy)).toBeLessThan(skiingScorer.scoreDay(base));
  });
});
