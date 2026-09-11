"use client";

/**
 * Shrink an image in the browser before upload.
 *
 * Vercel functions reject request bodies over 4.5 MB, and the server resizes
 * to 2048px anyway, so downscaling here loses nothing while keeping large
 * screenshots / scans uploadable.
 */
export const UPLOAD_TARGET_BYTES = 3.5 * 1024 * 1024;
export const UPLOAD_MAX_DIMENSION = 2048;
export const RAW_INPUT_MAX_BYTES = 30 * 1024 * 1024;

export type PreparedUpload = {
  file: File;
  /** True when the image was re-encoded (resized and/or compressed). */
  changed: boolean;
  width: number;
  height: number;
};

export async function prepareForUpload(input: File): Promise<PreparedUpload> {
  const bitmap = await createImageBitmap(input, { imageOrientation: "from-image" });
  try {
    const { width, height } = bitmap;
    const scale = Math.min(1, UPLOAD_MAX_DIMENSION / Math.max(width, height));
    if (scale === 1 && input.size <= UPLOAD_TARGET_BYTES) {
      return { file: input, changed: false, width, height };
    }

    let w = Math.max(1, Math.round(width * scale));
    let h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available in this browser");

    const encode = (mime: string, quality: number) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, quality));

    // Prefer WebP; fall back to JPEG where the browser cannot encode WebP.
    let mime = "image/webp";
    for (let pass = 0; pass < 6; pass++) {
      canvas.width = w;
      canvas.height = h;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(bitmap, 0, 0, w, h);

      for (const quality of [0.92, 0.85, 0.78, 0.7, 0.6]) {
        let blob = await encode(mime, quality);
        if (blob && blob.type !== mime) {
          mime = "image/jpeg";
          blob = await encode(mime, quality);
        }
        if (!blob) throw new Error("画像の再エンコードに失敗しました");
        if (blob.size <= UPLOAD_TARGET_BYTES) {
          const ext = mime === "image/webp" ? "webp" : "jpg";
          const name = input.name.replace(/\.[^.]+$/, "") + `.${ext}`;
          return { file: new File([blob], name, { type: mime }), changed: true, width: w, height: h };
        }
      }
      // Still too large at the lowest quality: shrink and try again.
      w = Math.round(w * 0.8);
      h = Math.round(h * 0.8);
    }
    throw new Error("画像を十分に小さくできませんでした。別の画像をお試しください");
  } finally {
    bitmap.close();
  }
}
