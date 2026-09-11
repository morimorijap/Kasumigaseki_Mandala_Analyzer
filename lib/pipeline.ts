/**
 * POST /api/analyze server flow (spec §15):
 *   validate → decode → strip → resize → re-encode → sha256 → store →
 *   submissions → features → analyzers (parallel) → model_runs → judge →
 *   KMI in TypeScript → final_results → response
 */
import { extractImageFeatures, featuresAsText } from "@/lib/image/features";
import { preprocessImage } from "@/lib/image/preprocess";
import { runAnalyzer, type AnalyzerOutcome } from "@/lib/llm/analyzer";
import { ANALYZER_NAMES, analyzerModels, judgeModel } from "@/lib/llm/config";
import { runJudge } from "@/lib/llm/judge";
import { PROMPT_VERSION } from "@/lib/llm/prompts";
import { RUBRIC_VERSION } from "@/lib/scoring/rubric";
import { buildReportMarkdown } from "@/lib/scoring/report";
import { dimensionMedians, synthesize, type NamedAnalyzerResult } from "@/lib/scoring/synthesize";
import { getStorage, objectKeyFor } from "@/lib/storage";
import { getStore } from "@/lib/store";
import type { ResultResponse } from "@/lib/types";
import { toResultResponse } from "@/lib/results";

export class AnalysisError extends Error {
  constructor(
    message: string,
    public readonly status = 500,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AnalysisError";
  }
}

export type AnalyzeInput = {
  bytes: Uint8Array;
  originalFilename: string | null;
  anonymousSessionId: string | null;
};

export async function analyzeImage(input: AnalyzeInput): Promise<ResultResponse> {
  const store = getStore();
  const storage = getStorage();

  // 1–6. validate, decode, strip metadata, resize, re-encode, hash
  const img = await preprocessImage(input.bytes);

  // 7. private storage
  const objectKey = objectKeyFor(img.sha256, "webp");
  await storage.put(objectKey, img.stored, img.storedMime);

  // 9. deterministic features (computed before insert so they are stored with the submission)
  const features = await extractImageFeatures(img.stored);
  const featuresText = featuresAsText(features);

  // 8. submissions
  const submission = await store.insertSubmission({
    anonymousSessionId: input.anonymousSessionId,
    originalFilename: input.originalFilename,
    mimeType: img.storedMime,
    byteSize: img.stored.byteLength,
    width: img.width,
    height: img.height,
    sha256: img.sha256,
    storageObjectKey: objectKey,
    imageFeatures: features,
    promptVersion: PROMPT_VERSION,
    rubricVersion: RUBRIC_VERSION,
  });

  // 10–11. analyzers in parallel, every run persisted
  const llmImage = { data: img.forLlm, mime: img.forLlmMime };
  const refs = analyzerModels();
  const analyzerOutcomes: AnalyzerOutcome[] = await Promise.all(
    refs.map((ref, i) => runAnalyzer(ref, ANALYZER_NAMES[i] ?? `Analyzer ${i + 1}`, llmImage, featuresText)),
  );
  // Inserted sequentially so created_at order == analyzer order (A, B, C…),
  // which is how the judge and the result view refer to them.
  for (const a of analyzerOutcomes) {
    await store.insertModelRun({
      submissionId: submission.id,
      stage: "analyzer",
      provider: a.ref.provider,
      model: a.ref.model,
      promptHash: a.promptHash,
      result: a.result,
      rawText: a.rawText,
      latencyMs: a.latencyMs,
      usage: a.usage,
      errorMessage: a.error,
    });
  }

  const successful: NamedAnalyzerResult[] = analyzerOutcomes
    .filter((a) => a.result)
    .map((a) => ({ name: a.name, result: a.result! }));
  if (successful.length === 0) {
    throw new AnalysisError(
      "すべてのAnalyzerが失敗しました",
      502,
      analyzerOutcomes.map((a) => ({ model: `${a.ref.provider}:${a.ref.model}`, error: a.error })),
    );
  }

  // 12. judge
  const medians = dimensionMedians(successful);
  const jref = judgeModel();
  const judge = await runJudge(jref, llmImage, featuresText, analyzerOutcomes, medians);
  await store.insertModelRun({
    submissionId: submission.id,
    stage: "judge",
    provider: judge.ref.provider,
    model: judge.ref.model,
    promptHash: judge.promptHash,
    result: judge.result,
    rawText: judge.rawText,
    latencyMs: judge.latencyMs,
    usage: judge.usage,
    errorMessage: judge.error,
  });

  // 13. code-side scoring
  const synthesis = synthesize(successful, judge.result);
  const versions = {
    promptVersion: PROMPT_VERSION,
    rubricVersion: RUBRIC_VERSION,
    algorithmVersion: synthesis.algorithmVersion,
  };
  const report = buildReportMarkdown(synthesis, successful, judge.result, versions);

  // 14. final_results
  const final = await store.insertFinalResult({
    submissionId: submission.id,
    kmi: synthesis.kmi,
    grade: synthesis.grade,
    taizokaiAffinity: synthesis.taizokaiAffinity,
    kongokaiAffinity: synthesis.kongokaiAffinity,
    mandalaType: synthesis.mandalaType,
    dominantStyle: synthesis.dominantStyle,
    readability: synthesis.readability,
    dimensions: synthesis.dimensions,
    judgeResult: judge.result,
    finalReportMarkdown: report,
    algorithmVersion: synthesis.algorithmVersion,
  });

  // 15. response (same shape as GET /api/results/:id)
  const runs = await store.getModelRuns(submission.id);
  return toResultResponse(submission, final, runs);
}
