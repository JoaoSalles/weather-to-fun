import type { Cache } from './cache.port';

/** Cache implementation that stores nothing — used when caching is disabled. */
export class NoopCache implements Cache {
  async get<T>(_key: string): Promise<T | undefined> {
    return undefined;
  }

  async set<T>(_key: string, _value: T, _ttlSeconds: number): Promise<void> {
    // intentionally does nothing
  }
}
