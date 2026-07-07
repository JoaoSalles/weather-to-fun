import { describe, it, expect } from 'vitest';
import { indoorSightseeingScorer } from './indoor-sightseeing.scorer';
import { outdoorSightseeingScorer } from './outdoor-sightseeing.scorer';
import type { DailyWeather } from '../weather.types';

const storm: DailyWeather = {
  date: '2026-07-07', weatherCode: 95, tempMaxC: 6, tempMinC: 2,
  rainMm: 22, snowfallCm: 0, windSpeedMax: 48, windGustsMax: 70,
  windDirectionDominant: 200, precipitationProbabilityMax: 95,
};

describe('indoorSightseeingScorer', () => {
  it('is INDOOR_SIGHTSEEING', () =>
    expect(indoorSightseeingScorer.activity).toBe('INDOOR_SIGHTSEEING'));

  it('is the inverse of the outdoor score', () => {
    expect(indoorSightseeingScorer.scoreDay(storm)).toBe(
      100 - outdoorSightseeingScorer.scoreDay(storm),
    );
  });

  it('scores a stormy day highly', () => {
    expect(indoorSightseeingScorer.scoreDay(storm)).toBeGreaterThanOrEqual(75);
  });
});
