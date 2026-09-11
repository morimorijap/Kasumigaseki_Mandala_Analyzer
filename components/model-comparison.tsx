import { DIMENSION_KEYS } from "@/lib/scoring/rubric";
import { featuresAsText } from "@/lib/image/features";
import type { ResultResponse } from "@/lib/types";

function Section({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="rounded-xl border border-border bg-card">
      <summary className="px-4 py-3 font-bold">{title}</summary>
      <div className="border-t border-border px-4 py-4 text-sm">{children}</div>
    </details>
  );
}

function Json({ value }: { value: unknown }) {
  return (
    <pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-background p-3 font-mono text-xs leading-relaxed">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

/** Research-oriented collapsibles: every analyzer, the judge, features, versions. */
export function ModelComparison({ data }: { data: ResultResponse }) {
  const judge = data.final.judgeResult;
  return (
    <div className="space-y-3">
      {data.analyzers.map((a) => (
        <Section key={a.name} title={`${a.name} — ${a.provider}:${a.model}`}>
          <p className="text-xs text-muted">
            {a.latencyMs ? `${(a.latencyMs / 1000).toFixed(1)}s` : ""}
            {a.error && <span className="ml-2 text-accent">エラー: {a.error}</span>}
          </p>
          {a.result && (
            <>
              <div className="mt-2 grid gap-1 sm:grid-cols-3">
                {DIMENSION_KEYS.map((k) => (
                  <div key={k} className="flex justify-between rounded bg-background px-2 py-1 font-mono text-xs">
                    <span>{k}</span>
                    <span className="font-bold">{a.result!.dimensions[k].score}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2">
                胎蔵界 {a.result.mandalaAffinity.taizokai} / 金剛界 {a.result.mandalaAffinity.kongokai} / 可読性{" "}
                {a.result.readability.score} / 分類 {a.result.mandalaAffinity.classification}
              </p>
              {a.result.shortComment && <p className="mt-1 italic text-muted">「{a.result.shortComment}」</p>}
              <Json value={a.result} />
            </>
          )}
        </Section>
      ))}

      <Section title={`Judge comparison${data.judge ? ` — ${data.judge.provider}:${data.judge.model}` : ""}`}>
        {data.judge?.error && <p className="text-accent">エラー: {data.judge.error}（中央値をそのまま採用）</p>}
        {judge && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-muted">
                  <tr>
                    <th className="py-1 pr-2">Analyzer</th>
                    <th className="py-1 pr-2">画像忠実性</th>
                    <th className="py-1 pr-2">構造分析</th>
                    <th className="py-1 pr-2">曼荼羅対応</th>
                    <th className="py-1 pr-2">一貫性</th>
                    <th className="py-1 pr-2">再現性</th>
                    <th className="py-1 pr-2">明確性</th>
                    <th className="py-1">幻覚</th>
                  </tr>
                </thead>
                <tbody>
                  {judge.analyzer_evaluation.map((e) => (
                    <tr key={e.name} className="border-t border-border">
                      <td className="py-1 pr-2 font-medium">{e.name}</td>
                      <td className="py-1 pr-2 tabular-nums">{e.image_fidelity}</td>
                      <td className="py-1 pr-2 tabular-nums">{e.structure_accuracy}</td>
                      <td className="py-1 pr-2 tabular-nums">{e.mandala_mapping}</td>
                      <td className="py-1 pr-2 tabular-nums">{e.consistency}</td>
                      <td className="py-1 pr-2 tabular-nums">{e.reproducibility}</td>
                      <td className="py-1 pr-2 tabular-nums">{e.clarity}</td>
                      <td className="py-1">{e.hallucination}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {judge.preferred_analysis && <p className="mt-2">最も妥当な分析: {judge.preferred_analysis}</p>}
            {judge.final_synthesis_notes.length > 0 && (
              <ul className="mt-2 list-disc space-y-0.5 pl-5">
                {judge.final_synthesis_notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            )}
            <Json value={judge} />
          </>
        )}
      </Section>

      <Section title="Deterministic features（画像処理による特徴量）">
        <pre className="whitespace-pre-wrap font-mono text-xs">{featuresAsText(data.submission.imageFeatures)}</pre>
        <Json value={data.submission.imageFeatures} />
      </Section>

      <Section title="prompt / model / version">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs">
          <dt className="text-muted">submission</dt>
          <dd>{data.submission.id}</dd>
          <dt className="text-muted">created</dt>
          <dd>{data.submission.createdAt}</dd>
          <dt className="text-muted">sha256</dt>
          <dd className="break-all">{data.submission.sha256}</dd>
          <dt className="text-muted">stored image</dt>
          <dd>
            {data.submission.width}×{data.submission.height} {data.submission.mimeType} {data.submission.byteSize} bytes
          </dd>
          <dt className="text-muted">prompt_version</dt>
          <dd>{data.versions.promptVersion}</dd>
          <dt className="text-muted">rubric_version</dt>
          <dd>{data.versions.rubricVersion}</dd>
          <dt className="text-muted">algorithm_version</dt>
          <dd>{data.versions.algorithmVersion}</dd>
          <dt className="text-muted">analyzers</dt>
          <dd>{data.analyzers.map((a) => `${a.provider}:${a.model}`).join(", ")}</dd>
          <dt className="text-muted">judge</dt>
          <dd>{data.judge ? `${data.judge.provider}:${data.judge.model}` : "—"}</dd>
        </dl>
      </Section>
    </div>
  );
}
