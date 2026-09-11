import { describe, expect, it } from "vitest";
import { checkRateLimitMemory, clientKey, isSameOriginRequest } from "@/lib/rate-limit";

describe("isSameOriginRequest", () => {
  const h = (o: Record<string, string>) => new Headers(o);
  it("allows non-browser callers (no origin / fetch metadata)", () => {
    expect(isSameOriginRequest(h({ host: "app.example" }))).toBe(true);
  });
  it("allows same-origin browser requests", () => {
    expect(isSameOriginRequest(h({ host: "app.example", origin: "https://app.example", "sec-fetch-site": "same-origin" }))).toBe(true);
  });
  it("rejects cross-site requests by fetch metadata", () => {
    expect(isSameOriginRequest(h({ host: "app.example", origin: "https://evil.example", "sec-fetch-site": "cross-site" }))).toBe(false);
  });
  it("rejects mismatched origin even without fetch metadata", () => {
    expect(isSameOriginRequest(h({ host: "app.example", origin: "https://evil.example" }))).toBe(false);
    expect(isSameOriginRequest(h({ host: "app.example", origin: "null" }))).toBe(false);
  });
  it("honours x-forwarded-host behind a proxy", () => {
    expect(isSameOriginRequest(h({ host: "internal:3000", "x-forwarded-host": "app.example", origin: "https://app.example" }))).toBe(true);
  });
});

describe("checkRateLimitMemory", () => {
  it("allows up to the limit then rejects with retry-after", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 10; i++) expect(checkRateLimitMemory(key, 1_000).ok).toBe(true);
    const blocked = checkRateLimitMemory(key, 1_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    // window expired → allowed again
    expect(checkRateLimitMemory(key, 1_000 + 11 * 60 * 1000).ok).toBe(true);
  });
});

describe("clientKey", () => {
  it("hashes the first forwarded IP", () => {
    const a = clientKey(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }));
    const b = clientKey(new Headers({ "x-forwarded-for": "203.0.113.5" }));
    expect(a).toBe(b);
    expect(a).not.toContain("203.0.113.5");
  });
});
