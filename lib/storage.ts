/**
 * Private image storage. Uploaded images are never served publicly; the
 * only readers are the analysis pipeline and (Phase 2) a signed-URL endpoint.
 *
 * Backends, chosen from the environment:
 *   1. S3-compatible bucket (Neon Object Storage etc.)  — NEON_STORAGE_* set
 *   2. Postgres bytea table `image_blobs`                — DATABASE_URL set
 *   3. In-memory map                                     — local dev fallback
 */
import { hasDatabase, getSql } from "@/lib/db";

export interface ObjectStorage {
  readonly kind: "s3" | "postgres" | "memory";
  put(key: string, data: Buffer, mime: string): Promise<void>;
  get(key: string): Promise<{ data: Buffer; mime: string } | null>;
}

class MemoryStorage implements ObjectStorage {
  readonly kind = "memory" as const;
  private static bag(): Map<string, { data: Buffer; mime: string }> {
    const g = globalThis as unknown as { __kmaMemoryStorage?: Map<string, { data: Buffer; mime: string }> };
    return (g.__kmaMemoryStorage ??= new Map());
  }
  async put(key: string, data: Buffer, mime: string) {
    MemoryStorage.bag().set(key, { data, mime });
  }
  async get(key: string) {
    return MemoryStorage.bag().get(key) ?? null;
  }
}

class PostgresStorage implements ObjectStorage {
  readonly kind = "postgres" as const;
  async put(key: string, data: Buffer, mime: string) {
    const sql = getSql();
    await sql`
      insert into image_blobs (object_key, mime_type, byte_size, data)
      values (${key}, ${mime}, ${data.byteLength}, ${data})
      on conflict (object_key) do nothing`;
  }
  async get(key: string) {
    const sql = getSql();
    const rows = await sql`select mime_type, data from image_blobs where object_key = ${key}`;
    if (!rows[0]) return null;
    const raw = rows[0].data as unknown;
    const data = Buffer.isBuffer(raw)
      ? raw
      : typeof raw === "string"
        ? Buffer.from(raw.replace(/^\\x/, ""), "hex")
        : Buffer.from(raw as Uint8Array);
    return { data, mime: String(rows[0].mime_type) };
  }
}

class S3Storage implements ObjectStorage {
  readonly kind = "s3" as const;
  private client: import("@aws-sdk/client-s3").S3Client | null = null;
  constructor(
    private readonly cfg: { endpoint: string; bucket: string; accessKeyId: string; secretAccessKey: string; region: string },
  ) {}
  private async s3() {
    if (!this.client) {
      const { S3Client } = await import("@aws-sdk/client-s3");
      this.client = new S3Client({
        endpoint: this.cfg.endpoint,
        region: this.cfg.region,
        forcePathStyle: true,
        credentials: { accessKeyId: this.cfg.accessKeyId, secretAccessKey: this.cfg.secretAccessKey },
      });
    }
    return this.client;
  }
  async put(key: string, data: Buffer, mime: string) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await (await this.s3()).send(
      new PutObjectCommand({ Bucket: this.cfg.bucket, Key: key, Body: data, ContentType: mime }),
    );
  }
  async get(key: string) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    try {
      const res = await (await this.s3()).send(new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
      if (!res.Body) return null;
      const bytes = await res.Body.transformToByteArray();
      return { data: Buffer.from(bytes), mime: res.ContentType ?? "application/octet-stream" };
    } catch (err) {
      if ((err as { name?: string }).name === "NoSuchKey") return null;
      throw err;
    }
  }
}

let storage: ObjectStorage | null = null;

export function getStorage(): ObjectStorage {
  if (storage) return storage;
  const endpoint = process.env.NEON_STORAGE_ENDPOINT;
  const bucket = process.env.NEON_STORAGE_BUCKET;
  const accessKeyId = process.env.NEON_STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.NEON_STORAGE_SECRET_ACCESS_KEY;
  if (endpoint && bucket && accessKeyId && secretAccessKey) {
    storage = new S3Storage({
      endpoint,
      bucket,
      accessKeyId,
      secretAccessKey,
      region: process.env.NEON_STORAGE_REGION ?? "auto",
    });
  } else if (hasDatabase()) {
    storage = new PostgresStorage();
  } else {
    console.warn("[storage] no object storage configured — keeping images in memory");
    storage = new MemoryStorage();
  }
  return storage;
}

export function objectKeyFor(sha256: string, ext: string): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `submissions/${yyyy}/${mm}/${sha256}.${ext}`;
}
