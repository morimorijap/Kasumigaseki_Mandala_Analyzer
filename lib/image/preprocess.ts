import { createHash } from "node:crypto";
import sharp from "sharp";

export const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type AllowedMime = (typeof ALLOWED_MIME_TYPES)[number];

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB
export const MAX_DIMENSION = 4096; // px, after validation
export const STORED_MAX_DIMENSION = Number(process.env.IMAGE_MAX_DIMENSION ?? 2048);
export const LLM_MAX_DIMENSION = Number(process.env.LLM_IMAGE_MAX_DIMENSION ?? 1568);

export class ImageValidationError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "ImageValidationError";
  }
}

/** Server-side magic-number sniffing; never trust the client MIME type. */
export function sniffMime(buf: Uint8Array): AllowedMime | null {
  if (buf.length < 12) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "image/png";
  }
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  // WebP: "RIFF" .... "WEBP"
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export type PreprocessedImage = {
  /** Metadata-stripped, resized, re-encoded WebP for private storage. */
  stored: Buffer;
  storedMime: "image/webp";
  width: number;
  height: number;
  sha256: string;
  /** Smaller JPEG copy sent to vision models. */
  forLlm: Buffer;
  forLlmMime: "image/jpeg";
  sourceMime: AllowedMime;
};

export async function preprocessImage(input: Uint8Array): Promise<PreprocessedImage> {
  if (input.byteLength === 0) throw new ImageValidationError("画像が空です");
  if (input.byteLength > MAX_UPLOAD_BYTES) {
    throw new ImageValidationError("画像は8MB以下にしてください", 413);
  }
  const sourceMime = sniffMime(input);
  if (!sourceMime) {
    throw new ImageValidationError("PNG / JPEG / WebP のみ対応しています（SVG・PDFは不可）", 415);
  }

  // limitInputPixels protects against decompression bombs.
  const base = sharp(Buffer.from(input), {
    limitInputPixels: MAX_DIMENSION * MAX_DIMENSION,
    animated: false,
  });
  let meta: sharp.Metadata;
  try {
    meta = await base.metadata();
  } catch {
    throw new ImageValidationError("画像をデコードできませんでした", 415);
  }
  if (!meta.width || !meta.height) throw new ImageValidationError("画像サイズを取得できません", 415);
  if (meta.width > MAX_DIMENSION || meta.height > MAX_DIMENSION) {
    throw new ImageValidationError(`画像は${MAX_DIMENSION}px四方以内にしてください`, 413);
  }

  // rotate() applies EXIF orientation, then all metadata is dropped on re-encode.
  const stored = await sharp(Buffer.from(input), { limitInputPixels: MAX_DIMENSION * MAX_DIMENSION })
    .rotate()
    .resize({
      width: STORED_MAX_DIMENSION,
      height: STORED_MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .flatten({ background: "#ffffff" })
    .webp({ quality: 90, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  const forLlm = await sharp(stored.data)
    .resize({
      width: LLM_MAX_DIMENSION,
      height: LLM_MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 88 })
    .toBuffer();

  return {
    stored: stored.data,
    storedMime: "image/webp",
    width: stored.info.width,
    height: stored.info.height,
    sha256: createHash("sha256").update(stored.data).digest("hex"),
    forLlm,
    forLlmMime: "image/jpeg",
    sourceMime,
  };
}
