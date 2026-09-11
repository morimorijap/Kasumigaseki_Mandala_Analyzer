import { NextResponse } from "next/server";
import { AnalysisError, analyzeImage } from "@/lib/pipeline";
import { ImageValidationError, MAX_UPLOAD_BYTES } from "@/lib/image/preprocess";
import { checkRateLimit, clientKey, isSameOriginRequest } from "@/lib/rate-limit";
import { isUuid } from "@/lib/results";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Two analyzers + a judge with vision can take a while.
export const maxDuration = 300;

export async function POST(req: Request) {
  // Browser requests must come from this site; non-browser clients send no Origin/Sec-Fetch-Site.
  if (!isSameOriginRequest(req.headers)) {
    return NextResponse.json({ error: "cross-site requests are not accepted" }, { status: 403 });
  }

  const rl = await checkRateLimit(clientKey(req.headers));
  if (!rl.ok) {
    return NextResponse.json(
      { error: "しばらく時間をおいて再度お試しください" },
      { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } },
    );
  }

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_UPLOAD_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "画像は8MB以下にしてください" }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "multipart/form-data で image を送信してください" }, { status: 400 });
  }
  const file = form.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "image フィールドがありません" }, { status: 400 });
  }
  const sessionRaw = form.get("session");
  const anonymousSessionId = typeof sessionRaw === "string" && isUuid(sessionRaw) ? sessionRaw : null;

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await analyzeImage({
      bytes,
      // Only the extension is kept: filenames often carry names / internal paths.
      originalFilename: file.name ? extensionOnly(file.name) : null,
      anonymousSessionId,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ImageValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof AnalysisError) {
      return NextResponse.json({ error: err.message, details: err.details }, { status: err.status });
    }
    if (err instanceof Error && /budget|timed out/i.test(err.message)) {
      return NextResponse.json({ error: "解析がタイムアウトしました。しばらくして再度お試しください" }, { status: 504 });
    }
    console.error("[analyze] failed", err);
    return NextResponse.json({ error: "解析中にエラーが発生しました" }, { status: 500 });
  }
}

function extensionOnly(name: string): string | null {
  const m = /\.([a-z0-9]{1,5})$/i.exec(name.trim());
  return m ? `*.${m[1].toLowerCase()}` : null;
}
