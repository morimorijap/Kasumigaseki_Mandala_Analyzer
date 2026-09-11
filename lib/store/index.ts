import { hasDatabase } from "@/lib/db";
import { MemoryStore } from "./memory";
import { PostgresStore } from "./postgres";
import type { Store } from "./types";

let store: Store | null = null;

export function getStore(): Store {
  if (!store) {
    if (hasDatabase()) {
      store = new PostgresStore();
    } else {
      console.warn("[store] DATABASE_URL not set — using in-memory store (results vanish on restart)");
      store = new MemoryStore();
    }
  }
  return store;
}

export type { Store } from "./types";
