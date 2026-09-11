import { DIMENSION_KEYS } from "@/lib/scoring/rubric";
import type { FinalResult } from "@/lib/types";

const SIZE = 420;
const R = 120;
const CX = SIZE / 2;
const CY = SIZE / 2;

function point(i: number, value: number, n: number): [number, number] {
  const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
  const r = (R * value) / 5;
  return [CX + r * Math.cos(angle), CY + r * Math.sin(angle)];
}

export function DimensionRadar({ final }: { final: FinalResult }) {
  const n = DIMENSION_KEYS.length;
  const finals = DIMENSION_KEYS.map((k) => final.dimensions[k].final);
  const medians = DIMENSION_KEYS.map((k) => final.dimensions[k].median);
  const poly = (vals: number[]) => vals.map((v, i) => point(i, v, n).join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto w-full max-w-sm" role="img" aria-label="評価軸レーダーチャート">
      {[1, 2, 3, 4, 5].map((lvl) => (
        <polygon
          key={lvl}
          points={poly(Array(n).fill(lvl))}
          fill="none"
          stroke="var(--border)"
          strokeWidth={lvl === 5 ? 1.5 : 0.75}
        />
      ))}
      {DIMENSION_KEYS.map((k, i) => {
        const [x, y] = point(i, 5, n);
        const [lx, ly] = point(i, 5.8, n);
        const anchor = lx < CX - 8 ? "end" : lx > CX + 8 ? "start" : "middle";
        return (
          <g key={k}>
            <line x1={CX} y1={CY} x2={x} y2={y} stroke="var(--border)" strokeWidth={0.75} />
            <text x={lx} y={ly} fontSize={11} textAnchor={anchor} dominantBaseline="middle" fill="var(--muted)">
              {final.dimensions[k].label}
            </text>
          </g>
        );
      })}
      <polygon points={poly(medians)} fill="none" stroke="var(--indigo)" strokeWidth={1} strokeDasharray="3 3" />
      <polygon points={poly(finals)} fill="var(--accent)" fillOpacity={0.25} stroke="var(--accent)" strokeWidth={2} />
      {finals.map((v, i) => {
        const [x, y] = point(i, v, n);
        return <circle key={i} cx={x} cy={y} r={3} fill="var(--accent)" />;
      })}
    </svg>
  );
}

export function DimensionTable({ final }: { final: FinalResult }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted">
          <tr>
            <th className="py-1 pr-2 font-medium">評価軸</th>
            <th className="whitespace-nowrap py-1 pr-2 text-right font-medium">中央値</th>
            <th className="whitespace-nowrap py-1 pr-2 text-right font-medium">Judge補正</th>
            <th className="whitespace-nowrap py-1 pr-2 text-right font-medium">最終</th>
            <th className="whitespace-nowrap py-1 text-right font-medium">配点</th>
          </tr>
        </thead>
        <tbody>
          {DIMENSION_KEYS.map((k) => {
            const d = final.dimensions[k];
            return (
              <tr key={k} className="border-t border-border">
                <td className="py-2 pr-2">
                  <span className="font-medium">{d.label}</span>
                  <span className="ml-1 font-mono text-xs text-muted">{k}</span>
                </td>
                <td className="py-2 pr-2 text-right tabular-nums text-muted">{d.median.toFixed(1)}</td>
                <td className="py-2 pr-2 text-right tabular-nums text-muted">
                  {d.judgeAdjustment === 0 ? "—" : (d.judgeAdjustment > 0 ? "+" : "") + d.judgeAdjustment.toFixed(1)}
                </td>
                <td className="py-2 pr-2 text-right text-base font-bold tabular-nums">{d.final.toFixed(1)}</td>
                <td className="whitespace-nowrap py-2 text-right tabular-nums text-muted">
                  {d.points} / {d.maxPoints}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function DimensionEvidence({ final }: { final: FinalResult }) {
  return (
    <div className="space-y-4">
      {DIMENSION_KEYS.map((k) => {
        const d = final.dimensions[k];
        return (
          <div key={k}>
            <h4 className="font-bold">
              {d.label} <span className="text-muted">— {d.final.toFixed(1)} / 5</span>
            </h4>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
              {d.evidence.map((e, i) => (
                <li key={i}>
                  {e.text} <span className="text-xs text-muted">（{e.analyzer}）</span>
                </li>
              ))}
              {d.judgeReason && (
                <li className="text-indigo">
                  Judge補正 {d.judgeAdjustment > 0 ? "+" : ""}
                  {d.judgeAdjustment}: {d.judgeReason}
                </li>
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
