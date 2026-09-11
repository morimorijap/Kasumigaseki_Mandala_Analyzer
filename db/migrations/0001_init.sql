-- Kasumigaseki Mandala Analyzer — initial schema (spec §14)
create extension if not exists pgcrypto;

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  anonymous_session_id uuid,

  created_at timestamptz not null default now(),

  original_filename text,
  mime_type text not null,
  byte_size integer not null,
  width integer not null,
  height integer not null,

  sha256 text not null,

  storage_object_key text not null,

  image_features jsonb not null default '{}'::jsonb,

  prompt_version text not null,
  rubric_version text not null
);

create index if not exists submissions_created_at_idx
  on submissions(created_at desc);

create index if not exists submissions_sha256_idx
  on submissions(sha256);

create table if not exists model_runs (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null
    references submissions(id) on delete cascade,

  created_at timestamptz not null default now(),

  stage text not null,
  provider text not null,
  model text not null,

  prompt_hash text,
  result jsonb,
  raw_text text,

  latency_ms integer,
  usage jsonb,
  error_message text
);

create index if not exists model_runs_submission_idx
  on model_runs(submission_id);

create table if not exists final_results (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique
    references submissions(id) on delete cascade,

  created_at timestamptz not null default now(),

  kmi numeric(5,2) not null,
  grade text not null,

  taizokai_affinity numeric(5,2) not null,
  kongokai_affinity numeric(5,2) not null,
  mandala_type text not null,

  readability numeric(5,2) not null,

  dimensions jsonb not null,
  judge_result jsonb not null,
  final_report_markdown text not null,

  algorithm_version text not null
);
