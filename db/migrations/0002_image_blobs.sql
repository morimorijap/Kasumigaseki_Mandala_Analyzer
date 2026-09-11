-- MVP fallback when Neon Object Storage is not configured (spec §12):
-- compressed images live in a private bytea table. Never exposed publicly.
create table if not exists image_blobs (
  object_key text primary key,
  created_at timestamptz not null default now(),
  mime_type text not null,
  byte_size integer not null,
  data bytea not null
);
