import { callVision } from "./gateway";
import { JudgeResultSchema, extractJson, type JudgeResult } from "./schemas";
import { buildJudgePrompt, promptHash } from "./prompts";
import type { AnalyzerOutcome } from "./analyzer";
import type { ModelRef } from "@/lib/types";
import { DIMENSION_KEYS } from "@/lib/scoring/rubric";

export type JudgeOutcome = {
  ref: ModelRef;
  result: JudgeResult | null;
  rawText: string | null;
  usage: unknown;
  latencyMs: number;
  error: string | null;
  promptHash: string;
};

const USER_MESSAGE =
  "上記のAnalyzer回答を画像と照合し、指示されたJSONのみを返してください。";

export async function runJudge(
  ref: ModelRef,
  image: { data: Buffer; mime: string },
  imageFeaturesText: string,
  analyzers: AnalyzerOutcome[],
  medians: Record<(typeof DIMENSION_KEYS)[number], number>,
): Promise<JudgeOutcome> {
  const analyzerResponses = analyzers
    .map((a) => {
      const header = `### ${a.name} (${a.ref.provider}:${a.ref.model})`;
      if (!a.result) return `${header}\n(失敗: ${a.error ?? "no result"})`;
      return `${header}\n${JSON.stringify(a.result, null, 1)}`;
    })
    .join("\n\n");
  const dimensionMedians = DIMENSION_KEYS.map((k) => `- ${k}: ${medians[k]}`).join("\n");

  const system = buildJudgePrompt({
    imageFeatures: imageFeaturesText,
    analyzerResponses,
    dimensionMedians,
  });
  const hash = promptHash(system);
  const started = Date.now();
  try {
    const res = await callVision(ref, { system, user: USER_MESSAGE, image });
    const parsed = JudgeResultSchema.safeParse(extractJson(res.text));
    if (!parsed.success) {
      return {
        ref,
        result: null,
        rawText: res.text,
        usage: res.usage,
        latencyMs: Date.now() - started,
        error: `schema validation failed: ${parsed.error.issues
          .slice(0, 5)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}`,
        promptHash: hash,
      };
    }
    return {
      ref,
      result: parsed.data,
      rawText: res.text,
      usage: res.usage,
      latencyMs: Date.now() - started,
      error: null,
      promptHash: hash,
    };
  } catch (err) {
    return {
      ref,
      result: null,
      rawText: null,
      usage: null,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
      promptHash: hash,
    };
  }
}
