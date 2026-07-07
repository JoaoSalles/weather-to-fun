import { describe, it, expect } from 'vitest';
import { clampScore } from './score-utils';

describe('clampScore', () => {
  it('rounds to an integer', () => {
    expect(clampScore(72.4)).toBe(72);
    expect(clampScore(72.6)).toBe(73);
  });
  it('clamps below 0 to 0 and above 100 to 100', () => {
    expect(clampScore(-5)).toBe(0);
    expect(clampScore(150)).toBe(100);
  });
});
