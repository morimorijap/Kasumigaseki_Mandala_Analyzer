import { randomUUID } from "node:crypto";
import type { FinalResult, ModelRun, Submission } from "@/lib/types";
import type { NewFinalResult, NewModelRun, NewSubmission, Store } from "./types";

/**
 * In-memory store for local development without DATABASE_URL. Survives
 * Next.js hot reloads via globalThis but not a process restart.
 */
type Bag = {
  submissions: Map<string, Submission>;
  runs: Map<string, ModelRun[]>;
  finals: Map<string, FinalResult>;
};

const g = globalThis as unknown as { __kmaMemoryStore?: Bag };
const bag: Bag = (g.__kmaMemoryStore ??= {
  submissions: new Map(),
  runs: new Map(),
  finals: new Map(),
});

export class MemoryStore implements Store {
  readonly kind = "memory" as const;

  async insertSubmission(s: NewSubmission): Promise<Submission> {
    const row: Submission = { ...s, id: randomUUID(), createdAt: new Date().toISOString() };
    bag.submissions.set(row.id, row);
    return row;
  }

  async insertModelRun(r: NewModelRun): Promise<ModelRun> {
    const row: ModelRun = { ...r, id: randomUUID(), createdAt: new Date().toISOString() };
    const list = bag.runs.get(r.submissionId) ?? [];
    list.push(row);
    bag.runs.set(r.submissionId, list);
    return row;
  }

  async insertFinalResult(r: NewFinalResult): Promise<FinalResult> {
    const row: FinalResult = { ...r, id: randomUUID(), createdAt: new Date().toISOString() };
    bag.finals.set(r.submissionId, row);
    return row;
  }

  async getSubmission(id: string): Promise<Submission | null> {
    return bag.submissions.get(id) ?? null;
  }

  async getModelRuns(submissionId: string): Promise<ModelRun[]> {
    return [...(bag.runs.get(submissionId) ?? [])];
  }

  async getFinalResult(submissionId: string): Promise<FinalResult | null> {
    return bag.finals.get(submissionId) ?? null;
  }

  async deleteSubmission(id: string): Promise<void> {
    bag.submissions.delete(id);
    bag.runs.delete(id);
    bag.finals.delete(id);
  }

  async countByObjectKey(objectKey: string): Promise<number> {
    let n = 0;
    for (const s of bag.submissions.values()) if (s.storageObjectKey === objectKey) n++;
    return n;
  }
}
