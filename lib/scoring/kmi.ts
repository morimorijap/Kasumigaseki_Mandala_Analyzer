/**
 * Code-side scoring engine. The LLMs never compute totals; everything on
 * this page is deterministic TypeScript (spec §3, §5, §8).
 */
import {
  DIMENSION_KEYS,
  GRADE_BANDS,
  RUBRIC_BY_KEY,
  type DimensionKey,
  type Grade,
} from "./rubric";

export const ALGORITHM_VERSION = "kmi-consensus-v1";

export type MandalaType = "taizokai" | "kongokai" | "hybrid" | "neither";

export type RawScores = Record<DimensionKey, number>;

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/** Median of a numeric list; NaN/undefined are dropped. Returns 0 for empty input. */
export function median(values: readonly (number | null | undefined)[]): number {
  const xs = values
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
    .sort((a, b) => a - b);
  if (xs.length === 0) return 0;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 === 1 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

/** KMI = Σ(max_points_i × raw_score_i / 5), 0–100. */
export function computeKmi(raw: RawScores): number {
  let total = 0;
  for (const key of DIMENSION_KEYS) {
    const score = clamp(raw[key] ?? 0, 0, 5);
    total += (RUBRIC_BY_KEY[key].maxPoints * score) / 5;
  }
  return round(clamp(total, 0, 100));
}

export function gradeForKmi(kmi: number): Grade {
  const k = clamp(kmi, 0, 100);
  for (const band of GRADE_BANDS) {
    if (k >= band.min) return band.grade;
  }
  return "非曼荼羅";
}

/**
 * Per-dimension consensus (spec §8):
 *   finalRaw = clamp(median(analyzers) + clamp(judgeAdjustment, -1, 1), 0, 5)
 */
export type DimensionConsensus = {
  key: DimensionKey;
  analyzerScores: number[];
  median: number;
  judgeAdjustment: number;
  final: number;
};

export function consensusDimension(
  key: DimensionKey,
  analyzerScores: readonly number[],
  judgeAdjustment: number | null | undefined,
): DimensionConsensus {
  const med = median(analyzerScores);
  const adj = clamp(judgeAdjustment ?? 0, -1, 1);
  return {
    key,
    analyzerScores: [...analyzerScores],
    median: round(med),
    judgeAdjustment: round(adj),
    final: round(clamp(med + adj, 0, 5)),
  };
}

export function consensusAll(
  analyzerDimensionScores: readonly Partial<RawScores>[],
  judgeAdjustments: Partial<Record<DimensionKey, number | null | undefined>>,
): Record<DimensionKey, DimensionConsensus> {
  const out = {} as Record<DimensionKey, DimensionConsensus>;
  for (const key of DIMENSION_KEYS) {
    const scores = analyzerDimensionScores
      .map((d) => d[key])
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    out[key] = consensusDimension(key, scores, judgeAdjustments[key]);
  }
  return out;
}

export function finalRawScores(
  consensus: Record<DimensionKey, DimensionConsensus>,
): RawScores {
  const raw = {} as RawScores;
  for (const key of DIMENSION_KEYS) raw[key] = consensus[key].final;
  return raw;
}

/**
 * Mandala type classification from the two affinities (spec §5).
 * Both high → hybrid; one clearly dominant → that type; both low → neither.
 */
export const AFFINITY_THRESHOLD = 50;
export const HYBRID_MARGIN = 20;

export function classifyMandala(taizokai: number, kongokai: number): MandalaType {
  const t = clamp(taizokai, 0, 100);
  const k = clamp(kongokai, 0, 100);
  if (t < AFFINITY_THRESHOLD && k < AFFINITY_THRESHOLD) return "neither";
  if (t >= AFFINITY_THRESHOLD && k >= AFFINITY_THRESHOLD && Math.abs(t - k) < HYBRID_MARGIN) {
    return "hybrid";
  }
  if (t >= AFFINITY_THRESHOLD && k >= AFFINITY_THRESHOLD) {
    // both above threshold but one dominates — still a hybrid, but note dominance
    return "hybrid";
  }
  return t >= k ? "taizokai" : "kongokai";
}

export function dominantStyle(type: MandalaType, taizokai: number, kongokai: number): string {
  switch (type) {
    case "taizokai":
      return "胎蔵界型";
    case "kongokai":
      return "金剛界型";
    case "hybrid":
      if (Math.abs(taizokai - kongokai) < 5) return "均衡した混合型";
      return taizokai > kongokai ? "胎蔵界優勢の混合型" : "金剛界優勢の混合型";
    case "neither":
      return "曼荼羅型構造なし";
  }
}

export const MANDALA_TYPE_LABEL: Record<MandalaType, string> = {
  taizokai: "胎蔵界型",
  kongokai: "金剛界型",
  hybrid: "混合型",
  neither: "非該当",
};
