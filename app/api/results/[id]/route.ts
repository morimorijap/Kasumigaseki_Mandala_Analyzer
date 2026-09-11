import { NextResponse } from "next/server";
import { loadResult } from "@/lib/results";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Results are addressed by unguessable UUID only; there is deliberately no
// listing endpoint (spec §13, §22).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const result = await loadResult(id);
    if (!result) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(result, { headers: { "cache-control": "private, max-age=60" } });
  } catch (err) {
    console.error("[results] failed", err);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}
