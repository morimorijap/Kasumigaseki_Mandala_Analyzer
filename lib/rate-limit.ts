/**
 * Best-effort in-memory rate limit for anonymous uploads. On serverless this
 * is per-instance, so it slows abuse rather than guaranteeing a global cap;
 * put a platform-level limit (Vercel WAF / Firewall) in front for production.
 */
const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 10 * 60 * 1000);
const MAX_PER_WINDOW = Number(process.env.RATE_LIMIT_MAX ?? 10);

type Bucket = { count: number; resetAt: number };
const g = globalThis as unknown as { __kmaRateLimit?: Map<string, Bucket> };
const buckets = (g.__kmaRateLimit ??= new Map());

export function checkRateLimit(key: string, now = Date.now()): { ok: boolean; retryAfterSec: number } {
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    return { ok: true, retryAfterSec: 0 };
  }
  if (b.count >= MAX_PER_WINDOW) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }
  b.count++;
  return { ok: true, retryAfterSec: 0 };
}

export function clientKey(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0].trim() : headers.get("x-real-ip") ?? "unknown";
  return ip;
}
