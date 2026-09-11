import { AnalyzerResultSchema } from "@/lib/llm/schemas";
import type { FinalResult, ModelRun, ResultResponse, Submission } from "@/lib/types";
import { getStore } from "@/lib/store";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

/** Shape the stored rows for the client. The image / storage key never leaves the server. */
export function toResultResponse(submission: Submission, final: FinalResult, runs: ModelRun[]): ResultResponse {
  const analyzerRuns = runs.filter((r) => r.stage === "analyzer");
  const judgeRun = runs.find((r) => r.stage === "judge") ?? null;
  const { storageObjectKey: _key, anonymousSessionId: _sid, ...publicSubmission } = submission;
  void _key;
  void _sid;
  return {
    submission: publicSubmission,
    final,
    analyzers: analyzerRuns.map((r, i) => {
      const parsed = r.result ? AnalyzerResultSchema.safeParse(r.result) : null;
      return {
        name: `Analyzer ${String.fromCharCode(65 + i)}`,
        provider: r.provider,
        model: r.model,
        result: parsed?.success ? parsed.data : null,
        error: r.errorMessage,
        latencyMs: r.latencyMs ?? 0,
      };
    }),
    judge: judgeRun
      ? { provider: judgeRun.provider, model: judgeRun.model, error: judgeRun.errorMessage, latencyMs: judgeRun.latencyMs ?? 0 }
      : null,
    versions: {
      promptVersion: submission.promptVersion,
      rubricVersion: submission.rubricVersion,
      algorithmVersion: final.algorithmVersion,
    },
  };
}

export async function loadResult(id: string): Promise<ResultResponse | null> {
  if (!isUuid(id)) return null;
  const store = getStore();
  const submission = await store.getSubmission(id);
  if (!submission) return null;
  const final = await store.getFinalResult(id);
  if (!final) return null;
  const runs = await store.getModelRuns(id);
  return toResultResponse(submission, final, runs);
}
