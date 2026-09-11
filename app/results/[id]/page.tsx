import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AffinityCard } from "@/components/affinity-card";
import { CopyButton } from "@/components/copy-button";
import { DimensionEvidence, DimensionRadar, DimensionTable } from "@/components/dimension-chart";
import { ModelComparison } from "@/components/model-comparison";
import { ReportMarkdown } from "@/components/report-markdown";
import { ScoreCard } from "@/components/score-card";
import { ShareLink } from "@/components/share-link";
import { loadResult } from "@/lib/results";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await loadResult(id).catch(() => null);
  if (!data) return { title: "結果が見つかりません — 霞ヶ関曼荼羅 Analyzer" };
  return {
    title: `KMI ${Math.round(data.final.kmi)} ${data.final.grade} — 霞ヶ関曼荼羅 Analyzer`,
    robots: { index: false },
  };
}

function headlineFromReport(markdown: string): string {
  const m = markdown.match(/^> (.+)$/m);
  return m ? m[1] : "";
}

export default async function ResultPage({ params }: Props) {
  const { id } = await params;
  const data = await loadResult(id);
  if (!data) notFound();

  const evidence = data.analyzers.flatMap((a) => a.result?.mandalaAffinity.evidence ?? []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← 別の画像を解析する
        </Link>
        <ShareLink path={`/results/${data.submission.id}`} />
      </div>

      <ScoreCard final={data.final} headline={headlineFromReport(data.final.finalReportMarkdown)} />

      <div className="grid gap-6 lg:grid-cols-2">
        <AffinityCard final={data.final} evidence={evidence} />
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-2 font-bold">評価軸（0–5）</h2>
          <DimensionRadar final={data.final} />
          <p className="mb-3 text-center text-xs text-muted">実線: 最終スコア / 点線: Analyzer中央値</p>
          <DimensionTable final={data.final} />
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-4 font-bold">根拠</h2>
        <DimensionEvidence final={data.final} />
      </section>

      <details className="rounded-2xl border border-border bg-card">
        <summary className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 font-bold">
          <span className="flex-1">最終統合レポート（Markdown）</span>
          <CopyButton text={data.final.finalReportMarkdown} label="Markdownをコピー" />
        </summary>
        <div className="border-t border-border px-6 py-4">
          <ReportMarkdown markdown={data.final.finalReportMarkdown} />
        </div>
      </details>

      <section>
        <h2 className="mb-3 font-bold">詳細（研究用）</h2>
        <ModelComparison data={data} />
      </section>
    </div>
  );
}
