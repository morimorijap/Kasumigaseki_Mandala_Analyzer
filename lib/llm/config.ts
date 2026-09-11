import { parseModelList, parseModelRef } from "./gateway";
import type { ModelRef } from "@/lib/types";

/**
 * Model slots. Defaults assume only OPENAI_API_KEY is available; override with
 * ANALYZER_MODELS / JUDGE_MODEL (comma-separated `provider:model`).
 */
export const DEFAULT_ANALYZER_MODELS = ["openai:gpt-5.4-mini", "openai:gpt-4.1"];
export const DEFAULT_JUDGE_MODEL = "openai:gpt-5.4";

export function analyzerModels(): ModelRef[] {
  return parseModelList(process.env.ANALYZER_MODELS, DEFAULT_ANALYZER_MODELS);
}

export function judgeModel(): ModelRef {
  return parseModelRef(process.env.JUDGE_MODEL?.trim() || DEFAULT_JUDGE_MODEL);
}

export const ANALYZER_NAMES = ["Analyzer A", "Analyzer B", "Analyzer C", "Analyzer D", "Analyzer E"];
