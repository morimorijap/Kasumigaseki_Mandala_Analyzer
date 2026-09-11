import { MANDALA_TYPE_LABEL } from "@/lib/scoring/kmi";
import type { FinalResult } from "@/lib/types";

function Bar({ label, value, colorClass, note }: { label: string; value: number; colorClass: string; note?: string }) {
  const v = Math.round(value);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-medium">{label}</span>
        <span className="text-2xl font-bold tabular-nums">{v}</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-border" aria-hidden>
        <div className={`h-full ${colorClass}`} style={{ width: `${v}%` }} />
      </div>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </div>
  );
}

export function AffinityCard({ final, evidence }: { final: FinalResult; evidence: string[] }) {
  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="font-bold">両界曼荼羅との形式的類似</h2>
        <span className="rounded-full bg-indigo-soft px-3 py-1 text-sm font-medium text-indigo">
          {MANDALA_TYPE_LABEL[final.mandalaType]} · {final.dominantStyle}
        </span>
      </div>
      <Bar label="胎蔵界型" value={final.taizokaiAffinity} colorClass="bg-accent" note="単一中心・放射・同心円・周辺が中心を囲む" />
      <Bar label="金剛界型" value={final.kongokaiAffinity} colorClass="bg-indigo" note="多区画・グリッド・同型モジュールの反復" />
      <Bar label="可読性" value={final.readability} colorClass="bg-gold" note="KMIとは独立。高いほど読みやすい" />
      {evidence.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          {evidence.slice(0, 6).map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
