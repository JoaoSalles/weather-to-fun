import { describe, it, expect } from 'vitest';
import { NoopCache } from './noop-cache';

describe('NoopCache', () => {
  it('get always resolves undefined', async () => {
    const cache = new NoopCache();
    await cache.set('k', { a: 1 }, 60);
    expect(await cache.get('k')).toBeUndefined();
  });

  it('set resolves without throwing', async () => {
    const cache = new NoopCache();
    await expect(cache.set('k', 'v', 60)).resolves.toBeUndefined();
  });
});
