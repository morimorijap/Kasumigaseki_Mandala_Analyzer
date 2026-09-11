import { describe, expect, it } from "vitest";
import { AnalyzerResultSchema, JudgeResultSchema, extractJson } from "@/lib/llm/schemas";
import { DIMENSION_KEYS } from "@/lib/scoring/rubric";

const validAnalyzer = {
  observation: { centralConcept: "X", majorRegions: ["a"], layoutSummary: "s", unreadableAreas: [] },
  dimensions: Object.fromEntries(DIMENSION_KEYS.map((k) => [k, { score: 3, evidence: ["e"], confidence: 0.5 }])),
  mandalaAffinity: { taizokai: 50, kongokai: 40, classification: "taizokai", evidence: ["e"] },
  readability: { score: 60, issues: [] },
  hallucinationCheck: { uncertainClaims: [], confidence: 0.9 },
};

describe("AnalyzerResultSchema", () => {
  it("accepts a valid result and coerces numeric strings", () => {
    const withStrings = structuredClone(validAnalyzer) as Record<string, unknown>;
    (withStrings.dimensions as Record<string, { score: unknown }>).centrality.score = "4";
    const parsed = AnalyzerResultSchema.parse(withStrings);
    expect(parsed.dimensions.centrality.score).toBe(4);
  });
  it("rejects a dimension without evidence", () => {
    const bad = structuredClone(validAnalyzer) as Record<string, unknown>;
    (bad.dimensions as Record<string, { evidence: unknown }>).centrality.evidence = [];
    expect(AnalyzerResultSchema.safeParse(bad).success).toBe(false);
  });
  it("rejects out-of-range scores", () => {
    const bad = structuredClone(validAnalyzer) as Record<string, unknown>;
    (bad.dimensions as Record<string, { score: unknown }>).centrality.score = 7;
    expect(AnalyzerResultSchema.safeParse(bad).success).toBe(false);
  });
  it("falls back on an unknown classification", () => {
    const odd = structuredClone(validAnalyzer) as Record<string, unknown>;
    (odd.mandalaAffinity as Record<string, unknown>).classification = "mixed";
    expect(AnalyzerResultSchema.parse(odd).mandalaAffinity.classification).toBe("neither");
  });
});

describe("JudgeResultSchema", () => {
  it("clamps adjustments into ±1 via catch", () => {
    const parsed = JudgeResultSchema.parse({
      analyzer_evaluation: [],
      dimension_adjustments: { centrality: { adjustment: 0.5, reason: "r" }, hierarchy: { adjustment: 5, reason: "r" } },
      preferred_analysis: "A",
      final_synthesis_notes: [],
      confidence: 0.5,
    });
    expect(parsed.dimension_adjustments.centrality?.adjustment).toBe(0.5);
    expect(parsed.dimension_adjustments.hierarchy?.adjustment).toBe(0);
  });
  it("tolerates missing sections", () => {
    const parsed = JudgeResultSchema.parse({ confidence: "0.4" });
    expect(parsed.analyzer_evaluation).toEqual([]);
    expect(parsed.confidence).toBe(0.4);
  });
});

describe("extractJson", () => {
  it("parses bare, fenced, and prose-wrapped JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('Here:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Sure! {"a":{"b":2}} done')).toEqual({ a: { b: 2 } });
  });
  it("throws when no object is present", () => {
    expect(() => extractJson("nothing here")).toThrow();
  });
});
