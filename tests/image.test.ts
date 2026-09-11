import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { preprocessImage, sniffMime, ImageValidationError } from "@/lib/image/preprocess";
import { extractImageFeatures } from "@/lib/image/features";

async function blank(w: number, h: number, fmt: "png" | "jpeg" | "webp" = "png"): Promise<Buffer> {
  const img = sharp({ create: { width: w, height: h, channels: 3, background: "#ffffff" } });
  return fmt === "png" ? img.png().toBuffer() : fmt === "jpeg" ? img.jpeg().toBuffer() : img.webp().toBuffer();
}

/** White canvas with a 3×3 grid of dark boxes — a crude "kongokai" shape. */
async function gridImage(): Promise<Buffer> {
  const boxes: sharp.OverlayOptions[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      boxes.push({
        input: { create: { width: 60, height: 60, channels: 3, background: "#2d4a7a" } },
        left: 20 + c * 100,
        top: 20 + r * 100,
      });
    }
  }
  return sharp({ create: { width: 320, height: 320, channels: 3, background: "#ffffff" } })
    .composite(boxes)
    .png()
    .toBuffer();
}

describe("sniffMime", () => {
  it("detects png / jpeg / webp by magic number", async () => {
    expect(sniffMime(await blank(4, 4, "png"))).toBe("image/png");
    expect(sniffMime(await blank(4, 4, "jpeg"))).toBe("image/jpeg");
    expect(sniffMime(await blank(4, 4, "webp"))).toBe("image/webp");
  });
  it("rejects svg / pdf / garbage", () => {
    expect(sniffMime(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"))).toBeNull();
    expect(sniffMime(Buffer.from("%PDF-1.7 aaaaaaaaaaaa"))).toBeNull();
    expect(sniffMime(Buffer.alloc(3))).toBeNull();
  });
});

describe("preprocessImage", () => {
  it("re-encodes to webp, strips metadata and hashes", async () => {
    const src = await sharp(await blank(300, 200)).withMetadata({ exif: { IFD0: { Copyright: "secret" } } }).png().toBuffer();
    const out = await preprocessImage(src);
    expect(out.storedMime).toBe("image/webp");
    expect(out.width).toBe(300);
    expect(out.height).toBe(200);
    expect(out.sha256).toMatch(/^[0-9a-f]{64}$/);
    const meta = await sharp(out.stored).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect(out.forLlmMime).toBe("image/jpeg");
  });
  it("rejects unsupported and empty input", async () => {
    await expect(preprocessImage(Buffer.from("%PDF-1.7 aaaaaaaaaaaa"))).rejects.toBeInstanceOf(ImageValidationError);
    await expect(preprocessImage(new Uint8Array())).rejects.toBeInstanceOf(ImageValidationError);
  });
  it("rejects oversized dimensions", async () => {
    // 5000×10 is within the byte limit but exceeds the 4096px rule
    await expect(preprocessImage(await blank(5000, 10))).rejects.toMatchObject({ status: 413 });
  });
});

describe("extractImageFeatures", () => {
  it("returns near-1 whitespace and zero edges for a blank image", async () => {
    const f = await extractImageFeatures(await blank(200, 100));
    expect(f.width).toBe(200);
    expect(f.aspectRatio).toBe(2);
    expect(f.whitespaceRatio).toBeGreaterThan(0.99);
    expect(f.edgeDensity).toBe(0);
    expect(f.connectedComponentCount).toBe(0);
    expect(f.colorEntropy).toBeLessThan(0.1);
  });
  it("counts components and finds edges on a 3×3 grid", async () => {
    const f = await extractImageFeatures(await gridImage());
    expect(f.connectedComponentCount).toBe(9);
    expect(f.edgeDensity).toBeGreaterThan(0.01);
    expect(f.whitespaceRatio).toBeLessThan(0.9);
    expect(f.whitespaceRatio).toBeGreaterThan(0.5);
    expect(f.centerVisualDensity).toBeGreaterThan(0);
    expect(f.peripheralVisualDensity).toBeGreaterThan(0);
  });
});
