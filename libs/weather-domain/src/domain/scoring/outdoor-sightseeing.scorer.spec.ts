import { describe, it, expect } from 'vitest';
import { outdoorSightseeingScorer, skyClearness } from './outdoor-sightseeing.scorer';
import type { DailyWeather } from '../weather.types';

const nice: DailyWeather = {
  date: '2026-07-07', weatherCode: 0, tempMaxC: 23, tempMinC: 17,
  rainMm: 0, snowfallCm: 0, windSpeedMax: 8, windGustsMax: 15,
  windDirectionDominant: 200, precipitationProbabilityMax: 5,
};

describe('skyClearness', () => {
  it('rewards clear codes and punishes storms', () => {
    expect(skyClearness(0)).toBeGreaterThan(skyClearness(3));
    expect(skyClearness(95)).toBeLessThan(skyClearness(3));
  });
});

describe('outdoorSightseeingScorer', () => {
  it('is OUTDOOR_SIGHTSEEING', () =>
    expect(outdoorSightseeingScorer.activity).toBe('OUTDOOR_SIGHTSEEING'));

  it('scores a clear, mild, calm, dry day highly', () => {
    expect(outdoorSightseeingScorer.scoreDay(nice)).toBeGreaterThanOrEqual(80);
  });

  it('scores a stormy, wet day low', () => {
    const storm: DailyWeather = {
      ...nice, weatherCode: 95, rainMm: 20, precipitationProbabilityMax: 95, windSpeedMax: 45,
    };
    expect(outdoorSightseeingScorer.scoreDay(storm)).toBeLessThanOrEqual(25);
  });
});
