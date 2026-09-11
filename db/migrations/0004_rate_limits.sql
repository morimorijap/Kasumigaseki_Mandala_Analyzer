-- Durable per-client rate limiting (in-memory buckets are per-instance on Vercel).
create table if not exists rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count integer not null default 0
);
