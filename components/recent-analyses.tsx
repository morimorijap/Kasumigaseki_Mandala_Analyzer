"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { RECENT_KEY, type RecentEntry } from "@/lib/client/session";

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};
const getSnapshot = () => {
  try {
    return window.localStorage.getItem(RECENT_KEY);
  } catch {
    return null;
  }
};
const getServerSnapshot = () => null;

/** Recent results for this browser only (localStorage) — there is no global listing. */
export function RecentAnalyses() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const items = useMemo<RecentEntry[]>(() => {
    try {
      return raw ? (JSON.parse(raw) as RecentEntry[]) : [];
    } catch {
      return [];
    }
  }, [raw]);
  if (items.length === 0) return null;
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-3 text-sm font-bold text-muted">このブラウザの最近の解析</h2>
      <ul className="divide-y divide-border text-sm">
        {items.map((e) => (
          <li key={e.id} className="flex items-center justify-between py-2">
            <Link href={`/results/${e.id}`} className="font-medium hover:text-accent">
              KMI {Math.round(e.kmi)} — {e.grade}
            </Link>
            <time className="text-xs text-muted" dateTime={e.at}>
              {new Date(e.at).toLocaleString("ja-JP")}
            </time>
          </li>
        ))}
      </ul>
    </section>
  );
}
