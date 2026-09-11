import { getSql } from "@/lib/db";
import type { FinalResult, ModelRun, Submission } from "@/lib/types";
import type { ImageFeatures } from "@/lib/image/features";
import type { NewFinalResult, NewModelRun, NewSubmission, Store } from "./types";

type Row = Record<string, unknown>;

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));
const num = (v: unknown) => Number(v);

function toSubmission(r: Row): Submission {
  return {
    id: String(r.id),
    anonymousSessionId: r.anonymous_session_id ? String(r.anonymous_session_id) : null,
    createdAt: iso(r.created_at),
    originalFilename: r.original_filename ? String(r.original_filename) : null,
    mimeType: String(r.mime_type),
    byteSize: num(r.byte_size),
    width: num(r.width),
    height: num(r.height),
    sha256: String(r.sha256),
    storageObjectKey: String(r.storage_object_key),
    imageFeatures: r.image_features as ImageFeatures,
    promptVersion: String(r.prompt_version),
    rubricVersion: String(r.rubric_version),
  };
}

function toModelRun(r: Row): ModelRun {
  return {
    id: String(r.id),
    submissionId: String(r.submission_id),
    createdAt: iso(r.created_at),
    stage: r.stage as ModelRun["stage"],
    provider: String(r.provider),
    model: String(r.model),
    promptHash: r.prompt_hash ? String(r.prompt_hash) : null,
    result: r.result ?? null,
    rawText: r.raw_text ? String(r.raw_text) : null,
    latencyMs: r.latency_ms == null ? null : num(r.latency_ms),
    usage: r.usage ?? null,
    errorMessage: r.error_message ? String(r.error_message) : null,
  };
}

/** The judge column is NOT NULL; a failed judge is stored as `{}` and read back as null. */
function nonEmptyJudge(v: unknown): FinalResult["judgeResult"] {
  if (!v || typeof v !== "object" || Object.keys(v as object).length === 0) return null;
  return v as FinalResult["judgeResult"];
}

function toFinalResult(r: Row): FinalResult {
  const extra = (r.dimensions as { __meta?: { dominantStyle?: string } })?.__meta ?? {};
  const dims = { ...(r.dimensions as Record<string, unknown>) };
  delete dims.__meta;
  return {
    id: String(r.id),
    submissionId: String(r.submission_id),
    createdAt: iso(r.created_at),
    kmi: num(r.kmi),
    grade: String(r.grade),
    taizokaiAffinity: num(r.taizokai_affinity),
    kongokaiAffinity: num(r.kongokai_affinity),
    mandalaType: r.mandala_type as FinalResult["mandalaType"],
    dominantStyle: extra.dominantStyle ?? "",
    readability: num(r.readability),
    dimensions: dims as FinalResult["dimensions"],
    judgeResult: nonEmptyJudge(r.judge_result),
    finalReportMarkdown: String(r.final_report_markdown),
    algorithmVersion: String(r.algorithm_version),
  };
}

export class PostgresStore implements Store {
  readonly kind = "postgres" as const;

  async insertSubmission(s: NewSubmission): Promise<Submission> {
    const sql = getSql();
    const rows = await sql`
      insert into submissions (
        anonymous_session_id, original_filename, mime_type, byte_size, width, height,
        sha256, storage_object_key, image_features, prompt_version, rubric_version
      ) values (
        ${s.anonymousSessionId}, ${s.originalFilename}, ${s.mimeType}, ${s.byteSize},
        ${s.width}, ${s.height}, ${s.sha256}, ${s.storageObjectKey},
        ${JSON.stringify(s.imageFeatures)}::jsonb, ${s.promptVersion}, ${s.rubricVersion}
      ) returning *`;
    return toSubmission(rows[0]);
  }

  async insertModelRun(r: NewModelRun): Promise<ModelRun> {
    const sql = getSql();
    const rows = await sql`
      insert into model_runs (
        submission_id, stage, provider, model, prompt_hash, result, raw_text,
        latency_ms, usage, error_message
      ) values (
        ${r.submissionId}, ${r.stage}, ${r.provider}, ${r.model}, ${r.promptHash},
        ${r.result == null ? null : JSON.stringify(r.result)}::jsonb, ${r.rawText},
        ${r.latencyMs}, ${r.usage == null ? null : JSON.stringify(r.usage)}::jsonb, ${r.errorMessage}
      ) returning *`;
    return toModelRun(rows[0]);
  }

  async insertFinalResult(r: NewFinalResult): Promise<FinalResult> {
    const sql = getSql();
    // dominantStyle has no column of its own; keep it inside the dimensions JSON.
    const dimensions = { ...r.dimensions, __meta: { dominantStyle: r.dominantStyle } };
    const rows = await sql`
      insert into final_results (
        submission_id, kmi, grade, taizokai_affinity, kongokai_affinity, mandala_type,
        readability, dimensions, judge_result, final_report_markdown, algorithm_version
      ) values (
        ${r.submissionId}, ${r.kmi}, ${r.grade}, ${r.taizokaiAffinity}, ${r.kongokaiAffinity},
        ${r.mandalaType}, ${r.readability}, ${JSON.stringify(dimensions)}::jsonb,
        ${JSON.stringify(r.judgeResult ?? {})}::jsonb, ${r.finalReportMarkdown}, ${r.algorithmVersion}
      ) returning *`;
    return toFinalResult(rows[0]);
  }

  async getSubmission(id: string): Promise<Submission | null> {
    const sql = getSql();
    const rows = await sql`select * from submissions where id = ${id}::uuid`;
    return rows[0] ? toSubmission(rows[0]) : null;
  }

  async getModelRuns(submissionId: string): Promise<ModelRun[]> {
    const sql = getSql();
    const rows = await sql`
      select * from model_runs where submission_id = ${submissionId}::uuid order by created_at asc, id asc`;
    return rows.map(toModelRun);
  }

  async getFinalResult(submissionId: string): Promise<FinalResult | null> {
    const sql = getSql();
    const rows = await sql`select * from final_results where submission_id = ${submissionId}::uuid`;
    return rows[0] ? toFinalResult(rows[0]) : null;
  }

  async deleteSubmission(id: string): Promise<void> {
    const sql = getSql();
    await sql`delete from submissions where id = ${id}::uuid`;
  }

  async countByObjectKey(objectKey: string): Promise<number> {
    const sql = getSql();
    const rows = await sql`select count(*)::int as n from submissions where storage_object_key = ${objectKey}`;
    return Number(rows[0]?.n ?? 0);
  }
}
