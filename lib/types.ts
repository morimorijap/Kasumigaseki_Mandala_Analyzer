import type { DimensionKey } from "@/lib/scoring/rubric";
import type { DimensionConsensus, MandalaType } from "@/lib/scoring/kmi";
import type { AnalyzerResult, JudgeResult } from "@/lib/llm/schemas";
import type { ImageFeatures } from "@/lib/image/features";

export type ModelRef = { provider: string; model: string };

export type Stage = "analyzer" | "judge";

export type ModelRun = {
  id: string;
  submissionId: string;
  createdAt: string;
  stage: Stage;
  provider: string;
  model: string;
  promptHash: string | null;
  result: unknown | null;
  rawText: string | null;
  latencyMs: number | null;
  usage: unknown | null;
  errorMessage: string | null;
};

export type Submission = {
  id: string;
  anonymousSessionId: string | null;
  createdAt: string;
  originalFilename: string | null;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  sha256: string;
  storageObjectKey: string;
  imageFeatures: ImageFeatures;
  promptVersion: string;
  rubricVersion: string;
};

export type DimensionDetail = DimensionConsensus & {
  label: string;
  maxPoints: number;
  points: number;
  evidence: { analyzer: string; text: string }[];
  judgeReason: string | null;
};

export type FinalResult = {
  id: string;
  submissionId: string;
  createdAt: string;
  kmi: number;
  grade: string;
  taizokaiAffinity: number;
  kongokaiAffinity: number;
  mandalaType: MandalaType;
  dominantStyle: string;
  readability: number;
  dimensions: Record<DimensionKey, DimensionDetail>;
  judgeResult: JudgeResult | null;
  finalReportMarkdown: string;
  algorithmVersion: string;
};

export type AnalyzerRun = {
  name: string;
  provider: string;
  model: string;
  result: AnalyzerResult | null;
  error: string | null;
  latencyMs: number;
};

/** What GET /api/results/:id returns (never the image itself). */
export type ResultResponse = {
  submission: Omit<Submission, "storageObjectKey" | "anonymousSessionId">;
  final: FinalResult;
  analyzers: AnalyzerRun[];
  judge: { provider: string; model: string; error: string | null; latencyMs: number } | null;
  versions: {
    promptVersion: string;
    rubricVersion: string;
    algorithmVersion: string;
  };
};
