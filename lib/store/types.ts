import type { FinalResult, ModelRun, Submission } from "@/lib/types";

export type NewSubmission = Omit<Submission, "id" | "createdAt">;
export type NewModelRun = Omit<ModelRun, "id" | "createdAt">;
export type NewFinalResult = Omit<FinalResult, "id" | "createdAt">;

/** Persistence for submissions, per-model runs and the final result. */
export interface Store {
  readonly kind: "postgres" | "memory";
  insertSubmission(s: NewSubmission): Promise<Submission>;
  insertModelRun(r: NewModelRun): Promise<ModelRun>;
  insertFinalResult(r: NewFinalResult): Promise<FinalResult>;
  getSubmission(id: string): Promise<Submission | null>;
  getModelRuns(submissionId: string): Promise<ModelRun[]>;
  getFinalResult(submissionId: string): Promise<FinalResult | null>;
  /** Removes a submission and (via cascade) its runs / final result. */
  deleteSubmission(id: string): Promise<void>;
  /** How many submissions reference a storage object (images are content-addressed). */
  countByObjectKey(objectKey: string): Promise<number>;
}
