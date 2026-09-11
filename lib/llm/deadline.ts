/**
 * Per-request time budget so the whole pipeline (analyzers with retries +
 * judge) finishes inside the function's maxDuration instead of being killed
 * mid-way after the LLM calls have already been billed.
 */
export type Deadline = { at: number };

export const DEFAULT_ANALYSIS_BUDGET_MS = (() => {
  const v = Number(process.env.ANALYSIS_BUDGET_MS);
  return Number.isFinite(v) && v > 0 ? v : 270_000;
})();

const RESERVE_MS = 8_000; // leave room for scoring + DB writes

export function makeDeadline(budgetMs = DEFAULT_ANALYSIS_BUDGET_MS, now = Date.now()): Deadline {
  return { at: now + budgetMs };
}

export function remainingMs(d: Deadline, now = Date.now()): number {
  return Math.max(0, d.at - now - RESERVE_MS);
}

export function deadlineExceeded(d: Deadline, minMs = 15_000, now = Date.now()): boolean {
  return remainingMs(d, now) < minMs;
}

/** Largest per-call timeout that still fits in the budget. */
export function callTimeout(d: Deadline, preferredMs: number, now = Date.now()): number {
  return Math.max(1_000, Math.min(preferredMs, remainingMs(d, now)));
}
