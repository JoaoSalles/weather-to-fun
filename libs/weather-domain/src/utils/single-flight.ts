/**
 * Coalesces concurrent async calls that share a key so only one runs at a time.
 *
 * Prevents cache stampede: when many callers miss the cache for the same key at
 * once, only the first triggers the underlying work; the rest await its result.
 *
 * Scope is per-process (an in-memory map). Across replicas you would still get
 * one call per instance — acceptable here; a distributed lock (e.g. Redis SETNX
 * / redlock) would be needed for cross-instance deduplication.
 */
export class SingleFlight {
  private readonly inFlight = new Map<string, Promise<unknown>>();

  run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key) as Promise<T> | undefined;
    if (existing) return existing;

    // Delete on settle so the next call re-runs, and failures are never shared
    // beyond the callers already waiting on this in-flight promise.
    const promise = fn().finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, promise);
    return promise;
  }
}
