#!/usr/bin/env node
/**
 * Applies db/migrations/*.sql in filename order against DATABASE_URL.
 * Idempotent: every migration is written with IF NOT EXISTS and recorded in
 * schema_migrations.
 *
 *   npm run db:migrate
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const sql = neon(url);
const dir = path.join(process.cwd(), "db", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

await sql`create table if not exists schema_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
)`;
const applied = new Set((await sql`select name from schema_migrations`).map((r) => r.name));

for (const file of files) {
  if (applied.has(file)) {
    console.log(`skip   ${file}`);
    continue;
  }
  const text = readFileSync(path.join(dir, file), "utf8");
  // Neon's HTTP driver runs one statement per query; split on ';' at line ends.
  const statements = text
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
    .filter(Boolean);
  for (const stmt of statements) await sql.query(stmt);
  await sql`insert into schema_migrations(name) values (${file})`;
  console.log(`applied ${file}`);
}
console.log("migrations complete");
