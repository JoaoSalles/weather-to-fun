import type { Cache } from '@collinson/weather-domain';

/** Minimal slice of the node-redis client used by RedisCache. */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, opts: { EX: number }): Promise<unknown>;
}

/**
 * Best-effort Redis-backed Cache. On any Redis error it logs a warning and
 * degrades to a miss so the request falls through to upstream.
 */
export class RedisCache implements Cache {
  constructor(
    private readonly client: RedisLike,
    private readonly logger: Pick<Console, 'warn'> = console,
  ) {}

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : undefined;
    } catch (err) {
      this.logger.warn(`RedisCache.get failed for ${key}: ${String(err)}`);
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), { EX: ttlSeconds });
    } catch (err) {
      this.logger.warn(`RedisCache.set failed for ${key}: ${String(err)}`);
    }
  }
}
