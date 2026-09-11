"use client";

const SESSION_KEY = "kma.session";
export const RECENT_KEY = "kma.recent";

export type RecentEntry = { id: string; kmi: number; grade: string; at: string };

/** Anonymous browser id (spec §13). No account, no personal data. */
export function getSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let id = window.localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function getRecent(): RecentEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as RecentEntry[]) : [];
  } catch {
    return [];
  }
}

export function pushRecent(entry: RecentEntry): void {
  try {
    const list = [entry, ...getRecent().filter((e) => e.id !== entry.id)].slice(0, 20);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota / private mode */
  }
}
