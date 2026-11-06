/**
 * Fixed-window rate limiter kept in process memory (same deployment caveats
 * as lib/signal-store.ts). Generous by default: a call needs a few dozen
 * requests; this only stops floods.
 */
const WINDOW_MS = 10_000;
const LIMIT = Number(process.env.SIGNAL_RATE_LIMIT) || 300;
const MAX_KEYS = 50_000;

const g = globalThis as unknown as { __halcyonRate?: Map<string, { start: number; count: number }> };
const hits: Map<string, { start: number; count: number }> = (g.__halcyonRate ??= new Map());

/** Returns true if the request is allowed. */
export function allow(key: string, now = Date.now()): boolean {
  const entry = hits.get(key);
  if (!entry || now - entry.start >= WINDOW_MS) {
    if (hits.size >= MAX_KEYS) {
      hits.forEach((e, k) => now - e.start >= WINDOW_MS && hits.delete(k));
      if (hits.size >= MAX_KEYS) return false;
    }
    hits.set(key, { start: now, count: 1 });
    return true;
  }
  entry.count++;
  return entry.count <= LIMIT;
}

export function clientKey(headers: Headers, fallback = "unknown"): string {
  const fwd = headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0].trim() : headers.get("x-real-ip")) || fallback;
}
