import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { RUBRIC_VERSION, rubricAsText } from "@/lib/scoring/rubric";

export const PROMPT_VERSION = process.env.PROMPT_VERSION ?? "kasumigaseki-master-v1";

const PROMPT_DIR = path.join(process.cwd(), "prompts");

function loadPrompt(name: string): string {
  return readFileSync(path.join(PROMPT_DIR, name), "utf8");
}

let cache: { master: string; judge: string } | null = null;
function templates() {
  if (!cache) {
    cache = {
      master: loadPrompt("kasumigaseki-master.md"),
      judge: loadPrompt("judge.md"),
    };
  }
  return cache;
}

export function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

export function buildAnalyzerPrompt(vars: { imageFeatures: string }): string {
  return fill(templates().master, {
    kmi_rubric: rubricAsText(),
    rubric_version: RUBRIC_VERSION,
    image_features: vars.imageFeatures,
  });
}

export function buildJudgePrompt(vars: {
  imageFeatures: string;
  analyzerResponses: string;
  dimensionMedians: string;
}): string {
  return fill(templates().judge, {
    kmi_rubric: rubricAsText(),
    rubric_version: RUBRIC_VERSION,
    image_features: vars.imageFeatures,
    analyzer_responses: vars.analyzerResponses,
    dimension_medians: vars.dimensionMedians,
  });
}

export function promptHash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}
