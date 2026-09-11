import type { FinalResult } from "@/lib/types";

export function ScoreCard({ final, headline }: { final: FinalResult; headline: string }) {
  const kmi = Math.round(final.kmi);
  const hue = kmi >= 80 ? "text-accent" : kmi >= 60 ? "text-gold" : kmi >= 40 ? "text-indigo" : "text-muted";
  return (
    <section className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
      <p className="text-sm font-bold tracking-widest text-muted">霞ヶ関曼荼羅度</p>
      <p className={`mt-1 text-6xl font-bold tabular-nums ${hue}`}>
        {kmi}
        <span className="text-2xl text-muted"> / 100</span>
      </p>
      <p className="mt-2 text-2xl font-bold">{final.grade}</p>
      <p className="mx-auto mt-4 max-w-2xl text-balance text-muted">「{headline}」</p>
      <p className="mt-1 text-xs text-muted">※ 短評・根拠は AI が生成した文章です</p>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-border" aria-hidden>
        <div className="h-full bg-accent transition-all" style={{ width: `${kmi}%` }} />
      </div>
    </section>
  );
}
