import { describe, expect, it } from "vitest";
import { synthesize, dimensionMedians } from "@/lib/scoring/synthesize";
import { buildReportMarkdown } from "@/lib/scoring/report";
import type { AnalyzerResult, JudgeResult } from "@/lib/llm/schemas";
import { DIMENSION_KEYS } from "@/lib/scoring/rubric";

function analyzer(score: number, taizokai: number, kongokai: number, readability: number): AnalyzerResult {
  return {
    observation: { centralConcept: "地域循環共生圏", majorRegions: ["交通", "エネルギー"], layoutSummary: "中央核から放射", unreadableAreas: ["下部の極小文字"] },
    dimensions: Object.fromEntries(
      DIMENSION_KEYS.map((k) => [k, { score, evidence: [`${k} evidence`], confidence: 0.8 }]),
    ) as AnalyzerResult["dimensions"],
    mandalaAffinity: { taizokai, kongokai, classification: "hybrid", evidence: ["中央核あり"] },
    readability: { score: readability, issues: ["文字が小さい"] },
    hallucinationCheck: { uncertainClaims: [], confidence: 0.9 },
    shortComment: "見事な霞ヶ関曼荼羅です",
  };
}

describe("synthesize", () => {
  it("uses medians across analyzers and computes KMI in code", () => {
    const s = synthesize(
      [
        { name: "A", result: analyzer(5, 90, 60, 30) },
        { name: "B", result: analyzer(4, 94, 66, 24) },
        { name: "C", result: analyzer(3, 80, 50, 40) },
      ],
      null,
    );
    for (const k of DIMENSION_KEYS) expect(s.dimensions[k].median).toBe(4);
    expect(s.kmi).toBe(80);
    expect(s.grade).toBe("濃厚霞ヶ関曼荼羅");
    expect(s.taizokaiAffinity).toBe(90);
    expect(s.kongokaiAffinity).toBe(60);
    expect(s.readability).toBe(30);
    expect(s.mandalaType).toBe("hybrid");
    expect(s.dominantStyle).toBe("胎蔵界優勢の混合型");
  });

  it("applies judge adjustments only where given, bounded to ±1", () => {
    const judge: JudgeResult = {
      analyzer_evaluation: [],
      dimension_adjustments: {
        centrality: { adjustment: 1, reason: "中央核は極めて明確" },
        hierarchy: { adjustment: -0.5, reason: "階層は2段のみ" },
      },
      preferred_analysis: "A",
      final_synthesis_notes: ["note"],
      confidence: 0.7,
    };
    const s = synthesize([{ name: "A", result: analyzer(3, 70, 20, 50) }, { name: "B", result: analyzer(3, 70, 20, 50) }], judge);
    expect(s.dimensions.centrality.final).toBe(4);
    expect(s.dimensions.centrality.judgeReason).toBe("中央核は極めて明確");
    expect(s.dimensions.hierarchy.final).toBe(2.5);
    expect(s.dimensions.modularity.final).toBe(3);
    expect(s.dimensions.modularity.judgeReason).toBeNull();
    // 60 base + centrality +3 (15*1/5) - hierarchy 1.5 (15*0.5/5) = 61.5
    expect(s.kmi).toBe(61.5);
    expect(s.mandalaType).toBe("taizokai");
  });

  it("throws with no analyzers", () => {
    expect(() => synthesize([], null)).toThrow();
  });

  it("dimensionMedians returns one value per key", () => {
    const m = dimensionMedians([{ name: "A", result: analyzer(2, 0, 0, 0) }]);
    expect(Object.keys(m)).toHaveLength(9);
    expect(m.centrality).toBe(2);
  });
});

describe("buildReportMarkdown", () => {
  it("includes the headline, KMI, dimensions and disclaimer", () => {
    const analyzers = [{ name: "Analyzer A", result: analyzer(4, 80, 40, 35) }];
    const judge: JudgeResult = {
      analyzer_evaluation: [],
      dimension_adjustments: {},
      preferred_analysis: "Analyzer A",
      final_synthesis_notes: ["中央核が明確"],
      headline: "胎蔵界型の見本です。",
      confidence: 0.8,
    };
    const s = synthesize(analyzers, judge);
    const md = buildReportMarkdown(s, analyzers, judge, { promptVersion: "p1", rubricVersion: "r1", algorithmVersion: "a1" });
    expect(md).toContain("KMI）: 80 / 100");
    expect(md).toContain("> 胎蔵界型の見本です。");
    expect(md).toContain("| 中心性 (centrality) |");
    expect(md).toContain("prompt: p1 / rubric: r1 / algorithm: a1");
    expect(md).toContain("宗教的価値ではなく");
    expect(md).toContain("判読不能: 下部の極小文字");
  });
});
