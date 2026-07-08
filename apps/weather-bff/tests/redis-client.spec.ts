import { describe, it, expect, vi } from 'vitest';
import { connectRedis, type ManagedRedisClient } from '../src/cache/redis-client';

function fakeClient(overrides: Partial<ManagedRedisClient> = {}): ManagedRedisClient {
  return {
    connect: vi.fn(async () => undefined),
    ping: vi.fn(async () => 'PONG'),
    quit: vi.fn(async () => undefined),
    on: vi.fn(),
    get: vi.fn(async () => null),
    set: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe('connectRedis', () => {
  it('connects and registers an error handler', async () => {
    const client = fakeClient();
    await connectRedis(client);
    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(client.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('checkReadiness returns true when PING replies PONG', async () => {
    const conn = await connectRedis(fakeClient());
    await expect(conn.checkReadiness()).resolves.toBe(true);
  });

  it('checkReadiness returns false when PING throws', async () => {
    const client = fakeClient({
      ping: vi.fn(async () => {
        throw new Error('connection lost');
      }),
    });
    const conn = await connectRedis(client);
    await expect(conn.checkReadiness()).resolves.toBe(false);
  });

  it('shutdown quits the client', async () => {
    const client = fakeClient();
    const conn = await connectRedis(client);
    await conn.shutdown();
    expect(client.quit).toHaveBeenCalledTimes(1);
  });
});
