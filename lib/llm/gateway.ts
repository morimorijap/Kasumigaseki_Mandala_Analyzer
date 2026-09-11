/**
 * Thin provider adapters for vision calls. All external API access lives here
 * so analyzer.ts / judge.ts stay provider-agnostic.
 *
 * Model references are written as `provider:model`, e.g.
 *   openai:gpt-5.4-mini   anthropic:claude-sonnet-5   google:gemini-2.5-flash
 *   gateway:<model>       (any OpenAI-compatible endpoint, e.g. Neon AI Gateway)
 */
import type { ModelRef } from "@/lib/types";

export type VisionRequest = {
  system: string;
  user: string;
  image: { data: Buffer; mime: string };
  maxOutputTokens?: number;
  timeoutMs?: number;
};

export type VisionResponse = {
  text: string;
  usage: unknown;
  latencyMs: number;
};

export type LlmErrorCode = "config" | "http" | "timeout" | "network" | "empty";

/**
 * Error surfaced to callers (and ultimately persisted / returned to the
 * browser). Messages are deliberately generic: provider response bodies can
 * contain partial API keys or org ids, so those only go to the server log.
 */
export class LlmError extends Error {
  constructor(
    public readonly code: LlmErrorCode,
    public readonly provider: string,
    public readonly model: string,
    public readonly status?: number,
  ) {
    super(
      code === "http"
        ? `${provider}/${model}: upstream HTTP ${status}`
        : code === "timeout"
          ? `${provider}/${model}: timed out`
          : code === "config"
            ? `${provider}/${model}: provider not configured`
            : code === "empty"
              ? `${provider}/${model}: empty response`
              : `${provider}/${model}: network error`,
    );
    this.name = "LlmError";
  }
}

export function parseModelRef(ref: string): ModelRef {
  const trimmed = ref.trim();
  const idx = trimmed.indexOf(":");
  if (idx === -1) return { provider: "openai", model: trimmed };
  return { provider: trimmed.slice(0, idx).toLowerCase(), model: trimmed.slice(idx + 1) };
}

export function parseModelList(list: string | undefined, fallback: string[]): ModelRef[] {
  const src = list && list.trim() ? list.split(",") : fallback;
  return src.map((s) => s.trim()).filter(Boolean).map(parseModelRef);
}

const DEFAULT_TIMEOUT_MS = (() => {
  const v = Number(process.env.LLM_TIMEOUT_MS);
  return Number.isFinite(v) && v > 0 ? v : 120_000;
})();
const DEFAULT_MAX_OUTPUT_TOKENS = (() => {
  const v = Number(process.env.LLM_MAX_OUTPUT_TOKENS);
  return Number.isFinite(v) && v > 0 ? v : 6000;
})();
export { DEFAULT_TIMEOUT_MS };

export async function callVision(ref: ModelRef, req: VisionRequest): Promise<VisionResponse> {
  const started = Date.now();
  const timeoutMs = req.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxTokens = req.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
  let out: { text: string; usage: unknown };
  switch (ref.provider) {
    case "openai":
      out = await callOpenAiCompatible(ref, req, {
        baseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
        apiKey: process.env.OPENAI_API_KEY ?? process.env.OPENAI_KEY,
        keyName: "OPENAI_API_KEY",
        maxTokens,
        timeoutMs,
      });
      break;
    case "google":
      out = await callOpenAiCompatible(ref, req, {
        baseUrl:
          process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai",
        apiKey: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY,
        keyName: "GEMINI_API_KEY",
        maxTokens,
        timeoutMs,
      });
      break;
    case "gateway":
      out = await callOpenAiCompatible(ref, req, {
        baseUrl: process.env.NEON_AI_GATEWAY_BASE_URL,
        apiKey: process.env.NEON_AI_GATEWAY_TOKEN,
        keyName: "NEON_AI_GATEWAY_TOKEN",
        maxTokens,
        timeoutMs,
      });
      break;
    case "anthropic":
      out = await callAnthropic(ref, req, { maxTokens, timeoutMs });
      break;
    default:
      console.error(`[llm] unknown provider "${ref.provider}"`);
      throw new LlmError("config", ref.provider, ref.model);
  }
  return { ...out, latencyMs: Date.now() - started };
}

async function fetchJson(
  url: string,
  init: RequestInit,
  ref: ModelRef,
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    if (!res.ok) {
      // Server log only — never persisted or returned.
      console.error(`[llm] ${ref.provider}/${ref.model} HTTP ${res.status}: ${text.slice(0, 500)}`);
      throw new LlmError("http", ref.provider, ref.model, res.status);
    }
    return JSON.parse(text) as Record<string, unknown>;
  } catch (err) {
    if (err instanceof LlmError) throw err;
    if (ctrl.signal.aborted) throw new LlmError("timeout", ref.provider, ref.model);
    console.error(`[llm] ${ref.provider}/${ref.model} request failed:`, err instanceof Error ? err.message : err);
    throw new LlmError("network", ref.provider, ref.model);
  } finally {
    clearTimeout(timer);
  }
}

/** True for OpenAI models that use max_completion_tokens / reasoning_effort. */
function isOpenAiReasoningModel(model: string): boolean {
  return /^(gpt-5|o\d)/i.test(model);
}

async function callOpenAiCompatible(
  ref: ModelRef,
  req: VisionRequest,
  cfg: { baseUrl?: string; apiKey?: string; keyName: string; maxTokens: number; timeoutMs: number },
): Promise<{ text: string; usage: unknown }> {
  if (!cfg.baseUrl || !cfg.apiKey) {
    console.error(`[llm] provider ${ref.provider} not configured (${cfg.keyName} / base URL)`);
    throw new LlmError("config", ref.provider, ref.model);
  }

  const dataUrl = `data:${req.image.mime};base64,${req.image.data.toString("base64")}`;
  const body: Record<string, unknown> = {
    model: ref.model,
    messages: [
      { role: "system", content: req.system },
      {
        role: "user",
        content: [
          { type: "text", text: req.user },
          { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
        ],
      },
    ],
    response_format: { type: "json_object" },
  };
  if (ref.provider === "openai" && isOpenAiReasoningModel(ref.model)) {
    body.max_completion_tokens = cfg.maxTokens;
    const effort = process.env.OPENAI_REASONING_EFFORT ?? "low";
    if (effort !== "default") body.reasoning_effort = effort;
  } else {
    body.max_tokens = cfg.maxTokens;
    body.temperature = Number(process.env.LLM_TEMPERATURE ?? 0.2);
  }

  const json = await fetchJson(
    `${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify(body),
    },
    ref,
    cfg.timeoutMs,
  );
  const choices = json.choices as { message?: { content?: string | { text?: string }[] } }[] | undefined;
  const content = choices?.[0]?.message?.content;
  const text =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content.map((c) => c.text ?? "").join("")
        : "";
  if (!text) throw new LlmError("empty", ref.provider, ref.model);
  return { text, usage: json.usage ?? null };
}

async function callAnthropic(
  ref: ModelRef,
  req: VisionRequest,
  cfg: { maxTokens: number; timeoutMs: number },
): Promise<{ text: string; usage: unknown }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[llm] ANTHROPIC_API_KEY is not set");
    throw new LlmError("config", ref.provider, ref.model);
  }
  const baseUrl = (process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com").replace(/\/$/, "");

  const json = await fetchJson(
    `${baseUrl}/v1/messages`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ref.model,
        max_tokens: cfg.maxTokens,
        system: req.system,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: req.image.mime, data: req.image.data.toString("base64") },
              },
              { type: "text", text: req.user },
            ],
          },
          // Prefill nudges the model straight into the JSON object.
          { role: "assistant", content: "{" },
        ],
      }),
    },
    ref,
    cfg.timeoutMs,
  );
  const blocks = json.content as { type: string; text?: string }[] | undefined;
  const text = (blocks ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  if (!text) throw new LlmError("empty", ref.provider, ref.model);
  return { text: "{" + text, usage: json.usage ?? null };
}
