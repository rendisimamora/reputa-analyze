/**
 * Tiny in-memory TTL cache (per process).
 * Used to avoid re-fetching the same URL within a short window.
 */
interface Entry<V> {
  value: V;
  expiresAt: number;
}

export class TTLCache<K, V> {
  private store = new Map<K, Entry<V>>();
  constructor(private defaultTtlMs: number) {}

  get(key: K): V | undefined {
    const e = this.store.get(key);
    if (!e) return undefined;
    if (e.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return e.value;
  }

  set(key: K, value: V, ttlMs = this.defaultTtlMs) {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key: K) {
    this.store.delete(key);
  }

  size() {
    return this.store.size;
  }
}

// 5 minute fetch cache for collector
export const fetchCache = new TTLCache<string, string>(5 * 60 * 1000);
