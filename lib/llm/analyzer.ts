import { callVision, LlmError } from "./gateway";
import { AnalyzerResultSchema, extractJson, type AnalyzerResult } from "./schemas";
import { buildAnalyzerPrompt, promptHash } from "./prompts";
import type { ModelRef } from "@/lib/types";

export type AnalyzerOutcome = {
  ref: ModelRef;
  name: string;
  result: AnalyzerResult | null;
  rawText: string | null;
  usage: unknown;
  latencyMs: number;
  error: string | null;
  promptHash: string;
};

const USER_MESSAGE =
  "この画像を分析し、指示されたJSONのみを返してください。判読できない文字は推測せず unreadableAreas に記録してください。";

const MAX_ATTEMPTS = Number(process.env.LLM_MAX_ATTEMPTS ?? 2);

export async function runAnalyzer(
  ref: ModelRef,
  name: string,
  image: { data: Buffer; mime: string },
  imageFeaturesText: string,
): Promise<AnalyzerOutcome> {
  const system = buildAnalyzerPrompt({ imageFeatures: imageFeaturesText });
  const hash = promptHash(system);
  const started = Date.now();
  let lastError: string | null = null;
  let lastRaw: string | null = null;
  let usage: unknown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await callVision(ref, { system, user: USER_MESSAGE, image });
      lastRaw = res.text;
      usage = res.usage;
      const parsed = AnalyzerResultSchema.safeParse(extractJson(res.text));
      if (parsed.success) {
        return {
          ref,
          name,
          result: parsed.data,
          rawText: res.text,
          usage,
          latencyMs: Date.now() - started,
          error: null,
          promptHash: hash,
        };
      }
      lastError = `schema validation failed: ${parsed.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      // Configuration errors will not fix themselves on retry.
      if (err instanceof LlmError && (err.status === 401 || err.status === 404 || !err.status && /not set/.test(err.message))) {
        break;
      }
    }
  }

  return {
    ref,
    name,
    result: null,
    rawText: lastRaw,
    usage,
    latencyMs: Date.now() - started,
    error: lastError,
    promptHash: hash,
  };
}
