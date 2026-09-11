/**
 * Pure function: analyzer results + judge result → final scores.
 * No I/O, fully deterministic, unit-tested.
 */
import {
  ALGORITHM_VERSION,
  classifyMandala,
  computeKmi,
  consensusAll,
  dominantStyle,
  finalRawScores,
  gradeForKmi,
  median,
  round,
  type MandalaType,
} from "./kmi";
import { DIMENSION_KEYS, RUBRIC_BY_KEY, type DimensionKey } from "./rubric";
import type { AnalyzerResult, JudgeResult } from "@/lib/llm/schemas";
import type { DimensionDetail } from "@/lib/types";

export type NamedAnalyzerResult = { name: string; result: AnalyzerResult };

export type Synthesis = {
  kmi: number;
  grade: string;
  taizokaiAffinity: number;
  kongokaiAffinity: number;
  mandalaType: MandalaType;
  dominantStyle: string;
  readability: number;
  dimensions: Record<DimensionKey, DimensionDetail>;
  algorithmVersion: string;
};

export function dimensionMedians(analyzers: NamedAnalyzerResult[]): Record<DimensionKey, number> {
  const out = {} as Record<DimensionKey, number>;
  for (const key of DIMENSION_KEYS) {
    out[key] = round(median(analyzers.map((a) => a.result.dimensions[key].score)));
  }
  return out;
}

export function synthesize(analyzers: NamedAnalyzerResult[], judge: JudgeResult | null): Synthesis {
  if (analyzers.length === 0) throw new Error("No successful analyzer results to synthesize");

  const adjustments: Partial<Record<DimensionKey, number>> = {};
  const reasons: Partial<Record<DimensionKey, string>> = {};
  for (const key of DIMENSION_KEYS) {
    const adj = judge?.dimension_adjustments?.[key];
    if (adj && adj.adjustment !== 0) {
      adjustments[key] = adj.adjustment;
      reasons[key] = adj.reason;
    }
  }

  const consensus = consensusAll(
    analyzers.map((a) =>
      Object.fromEntries(DIMENSION_KEYS.map((k) => [k, a.result.dimensions[k].score])),
    ),
    adjustments,
  );
  const raw = finalRawScores(consensus);
  const kmi = computeKmi(raw);

  const dimensions = {} as Record<DimensionKey, DimensionDetail>;
  for (const key of DIMENSION_KEYS) {
    const c = consensus[key];
    const rubric = RUBRIC_BY_KEY[key];
    dimensions[key] = {
      ...c,
      label: rubric.label,
      maxPoints: rubric.maxPoints,
      points: round((rubric.maxPoints * c.final) / 5),
      evidence: analyzers.flatMap((a) =>
        a.result.dimensions[key].evidence.map((text) => ({ analyzer: a.name, text })),
      ),
      judgeReason: reasons[key] ?? null,
    };
  }

  const taizokai = round(median(analyzers.map((a) => a.result.mandalaAffinity.taizokai)));
  const kongokai = round(median(analyzers.map((a) => a.result.mandalaAffinity.kongokai)));
  const mandalaType = classifyMandala(taizokai, kongokai);
  const readability = round(median(analyzers.map((a) => a.result.readability.score)));

  return {
    kmi,
    grade: gradeForKmi(kmi),
    taizokaiAffinity: taizokai,
    kongokaiAffinity: kongokai,
    mandalaType,
    dominantStyle: dominantStyle(mandalaType, taizokai, kongokai),
    readability,
    dimensions,
    algorithmVersion: ALGORITHM_VERSION,
  };
}
