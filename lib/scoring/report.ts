/**
 * Final report (Markdown). Assembled in code from the synthesis, analyzer
 * observations and the judge's notes — the LLMs never write the totals.
 */
import { DIMENSION_KEYS } from "./rubric";
import { MANDALA_TYPE_LABEL } from "./kmi";
import type { Synthesis, NamedAnalyzerResult } from "./synthesize";
import type { JudgeResult } from "@/lib/llm/schemas";

export function headlineFor(s: Synthesis, judge: JudgeResult | null): string {
  if (judge?.headline?.trim()) return judge.headline.trim();
  const centre = s.dimensions.centrality.final >= 4 ? "強い中央核" : s.dimensions.centrality.final >= 2.5 ? "中央核" : "弱い中心";
  return `${centre}を持つ${s.dominantStyle}です（KMI ${s.kmi}、可読性 ${s.readability}）。`;
}

export function buildReportMarkdown(
  s: Synthesis,
  analyzers: NamedAnalyzerResult[],
  judge: JudgeResult | null,
  versions: { promptVersion: string; rubricVersion: string; algorithmVersion: string },
): string {
  const lines: string[] = [];
  lines.push(`# 霞ヶ関曼荼羅 分析レポート`);
  lines.push("");
  lines.push(`**霞ヶ関曼荼羅度（KMI）: ${s.kmi} / 100 — ${s.grade}**`);
  lines.push("");
  lines.push(`> ${headlineFor(s, judge)}`);
  lines.push("");
  lines.push(`| 指標 | 値 |`);
  lines.push(`|---|---:|`);
  lines.push(`| 胎蔵界型 類似度 | ${s.taizokaiAffinity} |`);
  lines.push(`| 金剛界型 類似度 | ${s.kongokaiAffinity} |`);
  lines.push(`| 分類 | ${MANDALA_TYPE_LABEL[s.mandalaType]}（${s.dominantStyle}） |`);
  lines.push(`| 可読性 | ${s.readability} / 100 |`);
  lines.push("");

  lines.push(`## 評価軸`);
  lines.push("");
  lines.push(`| 評価軸 | 中央値 | Judge補正 | 最終 (0–5) | 配点 |`);
  lines.push(`|---|---:|---:|---:|---:|`);
  for (const key of DIMENSION_KEYS) {
    const d = s.dimensions[key];
    const adj = d.judgeAdjustment === 0 ? "—" : (d.judgeAdjustment > 0 ? "+" : "") + d.judgeAdjustment;
    lines.push(`| ${d.label} (${key}) | ${d.median} | ${adj} | ${d.final} | ${d.points} / ${d.maxPoints} |`);
  }
  lines.push("");

  lines.push(`## 根拠`);
  lines.push("");
  for (const key of DIMENSION_KEYS) {
    const d = s.dimensions[key];
    lines.push(`### ${d.label} — ${d.final} / 5`);
    for (const e of d.evidence) lines.push(`- ${e.text}（${e.analyzer}）`);
    if (d.judgeReason) lines.push(`- Judge補正 ${d.judgeAdjustment > 0 ? "+" : ""}${d.judgeAdjustment}: ${d.judgeReason}`);
    lines.push("");
  }

  lines.push(`## 観察`);
  lines.push("");
  for (const a of analyzers) {
    const o = a.result.observation;
    lines.push(`### ${a.name}`);
    lines.push(`- 中心概念: ${o.centralConcept ?? "（特定できず）"}`);
    if (o.majorRegions.length) lines.push(`- 主要領域: ${o.majorRegions.join(" / ")}`);
    if (o.layoutSummary) lines.push(`- レイアウト: ${o.layoutSummary}`);
    if (o.unreadableAreas.length) lines.push(`- 判読不能: ${o.unreadableAreas.join(" / ")}`);
    if (a.result.shortComment) lines.push(`- 短評: ${a.result.shortComment}`);
    lines.push("");
  }

  const readabilityIssues = uniq(analyzers.flatMap((a) => a.result.readability.issues));
  if (readabilityIssues.length) {
    lines.push(`## 可読性の課題`);
    lines.push("");
    for (const i of readabilityIssues.slice(0, 12)) lines.push(`- ${i}`);
    lines.push("");
  }

  if (judge) {
    lines.push(`## Judge 統合所見`);
    lines.push("");
    for (const n of judge.final_synthesis_notes) lines.push(`- ${n}`);
    if (judge.preferred_analysis) lines.push(`- 最も妥当な分析: ${judge.preferred_analysis}`);
    lines.push(`- Judge信頼度: ${judge.confidence}`);
    lines.push("");
  } else {
    lines.push(`## Judge`);
    lines.push("");
    lines.push(`- Judgeは実行できなかったため、Analyzerの中央値をそのまま採用しています。`);
    lines.push("");
  }

  const uncertain = uniq(analyzers.flatMap((a) => a.result.hallucinationCheck.uncertainClaims));
  if (uncertain.length) {
    lines.push(`## 不確かな主張（ハルシネーションチェック）`);
    lines.push("");
    for (const u of uncertain.slice(0, 12)) lines.push(`- ${u}`);
    lines.push("");
  }

  lines.push(`---`);
  lines.push(
    `prompt: ${versions.promptVersion} / rubric: ${versions.rubricVersion} / algorithm: ${versions.algorithmVersion}`,
  );
  lines.push("");
  lines.push(
    `※ KMIは資料の品質評価ではありません。「曼荼羅」は密教美術の宗教的価値ではなく、中心・階層・反復・群構造・世界の一枚化といった空間構成上の特徴を形式的に参照したものです。`,
  );
  return lines.join("\n");
}

function uniq(xs: string[]): string[] {
  return [...new Set(xs.map((x) => x.trim()).filter(Boolean))];
}
