import { z } from "zod";
import { DIMENSION_KEYS } from "@/lib/scoring/rubric";

/** Coerce common LLM slips (numbers as strings, out-of-range) into the schema. */
const num01 = z.coerce.number().min(0).max(1);
const num05 = z.coerce.number().min(0).max(5);
const num0100 = z.coerce.number().min(0).max(100);
/** LLM-provided free text: bounded so a hostile image cannot inflate storage or the page. */
const SHORT = 400;
const LONG = 2000;
const shortStr = z.string().max(SHORT).catch((ctx) => String(ctx.input ?? "").slice(0, SHORT));
const strList = (max: number) => z.array(shortStr).max(max).catch([]);

export const DimensionScoreSchema = z.object({
  score: num05,
  evidence: z.array(shortStr).min(1).max(3),
  confidence: num01.catch(0.5),
});
export type DimensionScore = z.infer<typeof DimensionScoreSchema>;

export const MandalaClassificationSchema = z.enum([
  "taizokai",
  "kongokai",
  "hybrid",
  "neither",
]);

export const AnalyzerResultSchema = z.object({
  observation: z.object({
    centralConcept: shortStr.nullable().catch(null),
    majorRegions: strList(20),
    layoutSummary: z.string().max(LONG).catch((ctx) => String(ctx.input ?? "").slice(0, LONG)),
    unreadableAreas: strList(50),
  }),

  dimensions: z.object(
    Object.fromEntries(DIMENSION_KEYS.map((k) => [k, DimensionScoreSchema])) as Record<
      (typeof DIMENSION_KEYS)[number],
      typeof DimensionScoreSchema
    >,
  ),

  mandalaAffinity: z.object({
    taizokai: num0100,
    kongokai: num0100,
    classification: MandalaClassificationSchema.catch("neither"),
    evidence: z.array(shortStr).min(1).max(6),
  }),

  readability: z.object({
    score: num0100,
    issues: strList(10),
  }),

  hallucinationCheck: z.object({
    uncertainClaims: strList(50),
    confidence: num01.catch(0.5),
  }),

  /** Optional one-line comment in the "霞ヶ関マスター" voice. */
  shortComment: z.string().max(300).optional().catch(undefined),
});
export type AnalyzerResult = z.infer<typeof AnalyzerResultSchema>;

export const AnalyzerEvaluationSchema = z.object({
  name: shortStr,
  image_fidelity: num05.catch(0),
  structure_accuracy: num05.catch(0),
  mandala_mapping: num05.catch(0),
  consistency: num05.catch(0),
  reproducibility: num05.catch(0),
  clarity: num05.catch(0),
  hallucination: z.enum(["none", "minor", "major"]).catch("minor"),
  notes: strList(10),
});

export const DimensionAdjustmentSchema = z.object({
  adjustment: z.coerce.number().min(-1).max(1).catch(0),
  reason: shortStr.catch(""),
});

export const JudgeResultSchema = z.object({
  analyzer_evaluation: z.array(AnalyzerEvaluationSchema).catch([]),
  dimension_adjustments: z
    .partialRecord(z.enum(DIMENSION_KEYS), DimensionAdjustmentSchema)
    .catch({}),
  preferred_analysis: shortStr.catch(""),
  final_synthesis_notes: strList(20),
  /** Optional one-line verdict in the "霞ヶ関マスター" voice. */
  headline: z.string().max(200).optional().catch(undefined),
  confidence: num01.catch(0.5),
});
export type JudgeResult = z.infer<typeof JudgeResultSchema>;

/**
 * Pull the first JSON object out of a model reply that may be wrapped in
 * prose or ```json fences.
 */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall through */
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      /* fall through */
    }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new Error("No JSON object found in model output");
}
