/**
 * Rate limiting for anonymous uploads.
 *
 * Two layers:
 *  1. In-memory bucket — cheap first line, but per-instance on serverless.
 *  2. Postgres counter (`rate_limits`) — shared across instances, so the
 *     limit actually holds on Vercel. Skipped when DATABASE_URL is unset.
 *
 * A platform-level rule (Vercel WAF) in front of /api/analyze is still
 * recommended for production; this keeps abuse bounded, not impossible.
 */
import { createHash } from "node:crypto";
import { getSql, hasDatabase } from "@/lib/db";

function envInt(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

const WINDOW_MS = envInt("RATE_LIMIT_WINDOW_MS", 10 * 60 * 1000);
const MAX_PER_WINDOW = envInt("RATE_LIMIT_MAX", 10);

type Bucket = { count: number; resetAt: number };
const g = globalThis as unknown as { __kmaRateLimit?: Map<string, Bucket> };
const buckets = (g.__kmaRateLimit ??= new Map());

export type RateLimitResult = { ok: boolean; retryAfterSec: number };

export function checkRateLimitMemory(key: string, now = Date.now()): RateLimitResult {
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

/**
 * Shared counter. One atomic upsert: reset the window when it has expired,
 * otherwise increment. Fails open (with a log line) if the DB is unreachable
 * so a DB blip does not take the whole endpoint down.
 */
export async function checkRateLimitDurable(key: string, now = new Date()): Promise<RateLimitResult> {
  if (!hasDatabase()) return { ok: true, retryAfterSec: 0 };
  try {
    const sql = getSql();
    const rows = await sql`
      insert into rate_limits (key, window_start, count)
      values (${key}, ${now.toISOString()}, 1)
      on conflict (key) do update set
        count = case
          when rate_limits.window_start + (${WINDOW_MS} * interval '1 millisecond') <= ${now.toISOString()}::timestamptz
            then 1
          else rate_limits.count + 1
        end,
        window_start = case
          when rate_limits.window_start + (${WINDOW_MS} * interval '1 millisecond') <= ${now.toISOString()}::timestamptz
            then ${now.toISOString()}::timestamptz
          else rate_limits.window_start
        end
      returning count, window_start`;
    const count = Number(rows[0].count);
    if (count > MAX_PER_WINDOW) {
      const resetAt = new Date(rows[0].window_start as string).getTime() + WINDOW_MS;
      return { ok: false, retryAfterSec: Math.max(1, Math.ceil((resetAt - now.getTime()) / 1000)) };
    }
    return { ok: true, retryAfterSec: 0 };
  } catch (err) {
    console.error("[rate-limit] durable check failed; allowing request", err instanceof Error ? err.message : err);
    return { ok: true, retryAfterSec: 0 };
  }
}

export async function checkRateLimit(key: string): Promise<RateLimitResult> {
  const mem = checkRateLimitMemory(key);
  if (!mem.ok) return mem;
  return checkRateLimitDurable(key);
}

/**
 * Client key: hashed IP. On Vercel `x-forwarded-for`'s first hop is set by
 * the platform; behind another proxy configure it to overwrite the header.
 */
export function clientKey(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0].trim() : (headers.get("x-real-ip") ?? "unknown");
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

/**
 * Route Handlers get no automatic CSRF protection. multipart POSTs are CORS
 * "simple requests", so a third-party page could fire uploads from visitors'
 * browsers (and IPs). Only accept same-origin / non-browser callers.
 */
export function isSameOriginRequest(headers: Headers): boolean {
  const site = headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "same-site" && site !== "none") return false;
  const origin = headers.get("origin");
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return false;
    }
    const host = headers.get("x-forwarded-host") ?? headers.get("host");
    if (!host || originHost !== host) return false;
  }
  return true;
}
