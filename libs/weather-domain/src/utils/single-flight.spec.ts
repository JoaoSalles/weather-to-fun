import { describe, it, expect, vi } from 'vitest';
import { SingleFlight } from './single-flight';

describe('SingleFlight', () => {
  it('runs the function once for concurrent calls with the same key', async () => {
    const single = new SingleFlight();
    let resolve!: (value: string) => void;
    const fn = vi.fn(() => new Promise<string>((r) => (resolve = r)));

    const a = single.run('k', fn);
    const b = single.run('k', fn);
    const c = single.run('k', fn);
    resolve('value');

    await expect(Promise.all([a, b, c])).resolves.toEqual(['value', 'value', 'value']);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('runs separately for different keys', async () => {
    const single = new SingleFlight();
    const fn = vi.fn(async (v: string) => v);

    await Promise.all([single.run('a', () => fn('a')), single.run('b', () => fn('b'))]);

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('re-runs after the previous call settles', async () => {
    const single = new SingleFlight();
    const fn = vi.fn(async () => 'value');

    await single.run('k', fn);
    await single.run('k', fn);

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not share a rejection with later (non-concurrent) callers', async () => {
    const single = new SingleFlight();
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('ok');

    await expect(single.run('k', fn)).rejects.toThrow('boom');
    await expect(single.run('k', fn)).resolves.toBe('ok');
  });
});
