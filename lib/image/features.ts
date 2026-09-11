/**
 * Deterministic image features (spec §7). Computed with sharp on a downscaled
 * copy so they are cheap enough for a Vercel function. Passed to the LLMs as
 * evidence and stored alongside the submission.
 */
import sharp from "sharp";

export type ImageFeatures = {
  width: number;
  height: number;
  aspectRatio: number;

  /** Fraction of pixels whose Sobel gradient magnitude exceeds a threshold (0–1). */
  edgeDensity: number;
  /** Fraction of near-white pixels (0–1). */
  whitespaceRatio: number;
  /** Shannon entropy of a 4×4×4 quantised RGB histogram, in bits (0–6). */
  colorEntropy: number;

  /** Number of 4-connected "ink" blobs on the analysis-size image (≥ 4 px). */
  connectedComponentCount?: number;
  lineSegmentCount?: number;
  rectangleCount?: number;

  /** Non-white fraction inside the central third of the image (0–1). */
  centerVisualDensity?: number;
  /** Non-white fraction outside the central third (0–1). */
  peripheralVisualDensity?: number;

  /** Size of the downscaled image used for the pixel statistics. */
  analysisWidth: number;
  analysisHeight: number;
  featureVersion: string;
};

export const FEATURE_VERSION = "features-v1";

const ANALYSIS_MAX = 512;
const WHITE_THRESHOLD = 235; // luminance ≥ this counts as whitespace
const EDGE_THRESHOLD = 96; // Sobel magnitude (0–~1442) ≥ this counts as edge
const MIN_COMPONENT_PIXELS = 4;

export async function extractImageFeatures(image: Buffer): Promise<ImageFeatures> {
  const meta = await sharp(image).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  const { data, info } = await sharp(image)
    .resize({ width: ANALYSIS_MAX, height: ANALYSIS_MAX, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const n = w * h;
  const gray = new Uint8Array(n);
  const hist = new Uint32Array(64);
  let whiteCount = 0;

  for (let i = 0; i < n; i++) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];
    const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    gray[i] = lum;
    if (lum >= WHITE_THRESHOLD) whiteCount++;
    hist[(r >> 6) * 16 + (g >> 6) * 4 + (b >> 6)]++;
  }

  let entropy = 0;
  for (let k = 0; k < 64; k++) {
    if (hist[k] === 0) continue;
    const p = hist[k] / n;
    entropy -= p * Math.log2(p);
  }

  // Sobel edge density (interior pixels only).
  let edgeCount = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -gray[i - w - 1] + gray[i - w + 1] - 2 * gray[i - 1] + 2 * gray[i + 1] - gray[i + w - 1] + gray[i + w + 1];
      const gy =
        -gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1] + gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1];
      if (Math.hypot(gx, gy) >= EDGE_THRESHOLD) edgeCount++;
    }
  }
  const interior = Math.max(1, (w - 2) * (h - 2));

  // Center vs periphery ink density.
  const cx0 = Math.floor(w / 3);
  const cx1 = Math.floor((2 * w) / 3);
  const cy0 = Math.floor(h / 3);
  const cy1 = Math.floor((2 * h) / 3);
  let centerInk = 0;
  let centerPx = 0;
  let periInk = 0;
  let periPx = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ink = gray[y * w + x] < WHITE_THRESHOLD ? 1 : 0;
      if (x >= cx0 && x < cx1 && y >= cy0 && y < cy1) {
        centerInk += ink;
        centerPx++;
      } else {
        periInk += ink;
        periPx++;
      }
    }
  }

  return {
    width,
    height,
    aspectRatio: height > 0 ? round(width / height, 4) : 0,
    edgeDensity: round(edgeCount / interior, 4),
    whitespaceRatio: round(whiteCount / n, 4),
    colorEntropy: round(entropy, 4),
    connectedComponentCount: countComponents(gray, w, h),
    centerVisualDensity: round(centerPx ? centerInk / centerPx : 0, 4),
    peripheralVisualDensity: round(periPx ? periInk / periPx : 0, 4),
    analysisWidth: w,
    analysisHeight: h,
    featureVersion: FEATURE_VERSION,
  };
}

/** 4-connected components of non-white pixels, ignoring specks. */
function countComponents(gray: Uint8Array, w: number, h: number): number {
  const visited = new Uint8Array(w * h);
  const stack: number[] = [];
  let count = 0;
  for (let start = 0; start < w * h; start++) {
    if (visited[start] || gray[start] >= WHITE_THRESHOLD) continue;
    let size = 0;
    stack.push(start);
    visited[start] = 1;
    while (stack.length) {
      const i = stack.pop() as number;
      size++;
      const x = i % w;
      const y = (i - x) / w;
      if (x > 0) push(i - 1);
      if (x < w - 1) push(i + 1);
      if (y > 0) push(i - w);
      if (y < h - 1) push(i + w);
    }
    if (size >= MIN_COMPONENT_PIXELS) count++;
  }
  return count;

  function push(j: number) {
    if (!visited[j] && gray[j] < WHITE_THRESHOLD) {
      visited[j] = 1;
      stack.push(j);
    }
  }
}

function round(v: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

/** Compact, human-readable rendering for prompts. */
export function featuresAsText(f: ImageFeatures): string {
  const lines = [
    `size: ${f.width}x${f.height} (aspect ${f.aspectRatio})`,
    `edgeDensity: ${f.edgeDensity} (0=flat, higher=more lines/edges)`,
    `whitespaceRatio: ${f.whitespaceRatio} (fraction of near-white pixels)`,
    `colorEntropy: ${f.colorEntropy} bits (max 6; higher=more distinct colors)`,
  ];
  if (f.connectedComponentCount !== undefined) {
    lines.push(`connectedComponentCount: ${f.connectedComponentCount} (ink blobs at ${f.analysisWidth}x${f.analysisHeight})`);
  }
  if (f.centerVisualDensity !== undefined && f.peripheralVisualDensity !== undefined) {
    lines.push(`centerVisualDensity: ${f.centerVisualDensity} / peripheralVisualDensity: ${f.peripheralVisualDensity}`);
  }
  return lines.join("\n");
}
