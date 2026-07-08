import { createClient } from 'redis';

/**
 * Minimal slice of the node-redis client this app depends on: the cache
 * operations (get/set) plus connection lifecycle (connect/ping/quit/error).
 * Keeping it narrow makes the connection trivial to fake in tests.
 */
export interface ManagedRedisClient {
  connect(): Promise<unknown>;
  ping(): Promise<string>;
  quit(): Promise<unknown>;
  on(event: 'error', listener: (err: unknown) => void): unknown;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, opts: { EX: number }): Promise<unknown>;
}

export interface RedisConnection {
  client: ManagedRedisClient;
  /** Readiness probe: true when Redis answers a PING. */
  checkReadiness: () => Promise<boolean>;
  /** Closes the connection; safe to call once during shutdown. */
  shutdown: () => Promise<void>;
}

let singleton: Promise<RedisConnection> | undefined;

/**
 * Wires an already-constructed client into a managed connection. Exposed
 * separately from {@link getRedisConnection} so tests can inject a fake client.
 */
export async function connectRedis(client: ManagedRedisClient): Promise<RedisConnection> {
  client.on('error', (err) => console.warn(`Redis client error: ${String(err)}`));
  await client.connect();

  return {
    client,
    checkReadiness: async () => {
      try {
        return (await client.ping()) === 'PONG';
      } catch {
        return false;
      }
    },
    shutdown: async () => {
      await client.quit();
    },
  };
}

/**
 * Returns the process-wide Redis connection, creating and connecting it on
 * first call and reusing it thereafter (singleton). Redis is infrastructure,
 * not a domain service, so its lifecycle lives here rather than in the
 * composition root.
 */
export function getRedisConnection(url: string): Promise<RedisConnection> {
  if (!singleton) {
    singleton = connectRedis(createClient({ url }) as unknown as ManagedRedisClient);
  }
  return singleton;
}
