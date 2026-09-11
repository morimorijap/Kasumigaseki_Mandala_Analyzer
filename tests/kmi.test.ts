import { describe, expect, it } from "vitest";
import {
  classifyMandala,
  clamp,
  computeKmi,
  consensusDimension,
  gradeForKmi,
  median,
  type RawScores,
} from "@/lib/scoring/kmi";
import { DIMENSION_KEYS, RUBRIC, RUBRIC_MAX_TOTAL } from "@/lib/scoring/rubric";

const all = (v: number): RawScores =>
  Object.fromEntries(DIMENSION_KEYS.map((k) => [k, v])) as RawScores;

describe("rubric", () => {
  it("max points sum to 100", () => {
    expect(RUBRIC_MAX_TOTAL).toBe(100);
    expect(RUBRIC).toHaveLength(9);
  });
});

describe("computeKmi", () => {
  it("is 0 for all zeros and 100 for all fives", () => {
    expect(computeKmi(all(0))).toBe(0);
    expect(computeKmi(all(5))).toBe(100);
  });
  it("weights dimensions by max points", () => {
    // centrality alone at 5 → 15 points
    expect(computeKmi({ ...all(0), centrality: 5 })).toBe(15);
    // world_closure alone at 2.5 → 3 points
    expect(computeKmi({ ...all(0), world_closure: 2.5 })).toBe(3);
  });
  it("clamps out-of-range raw scores", () => {
    expect(computeKmi({ ...all(0), centrality: 9 })).toBe(15);
    expect(computeKmi({ ...all(0), centrality: -3 })).toBe(0);
  });
  it("reproduces the spec example ordering (§6: hybrid 95)", () => {
    const raw: RawScores = {
      centrality: 5,
      hierarchy: 4.5,
      relation_density: 5,
      information_density: 5,
      semantic_breadth: 5,
      modularity: 4.5,
      radial_or_grid_structure: 4.5,
      visual_coding: 5,
      world_closure: 5,
    };
    const kmi = computeKmi(raw);
    expect(kmi).toBeGreaterThanOrEqual(90);
    expect(gradeForKmi(kmi)).toBe("極密霞ヶ関曼荼羅");
  });
});

describe("gradeForKmi", () => {
  it("maps band boundaries", () => {
    expect(gradeForKmi(0)).toBe("非曼荼羅");
    expect(gradeForKmi(19.99)).toBe("非曼荼羅");
    expect(gradeForKmi(20)).toBe("ポンチ絵");
    expect(gradeForKmi(40)).toBe("準曼荼羅");
    expect(gradeForKmi(60)).toBe("霞ヶ関曼荼羅");
    expect(gradeForKmi(80)).toBe("濃厚霞ヶ関曼荼羅");
    expect(gradeForKmi(90)).toBe("極密霞ヶ関曼荼羅");
    expect(gradeForKmi(100)).toBe("極密霞ヶ関曼荼羅");
  });
});

describe("median / clamp", () => {
  it("handles odd, even, and empty lists", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBe(0);
    expect(median([2, null, undefined, NaN])).toBe(2);
  });
  it("clamps", () => {
    expect(clamp(7, 0, 5)).toBe(5);
    expect(clamp(-1, 0, 5)).toBe(0);
    expect(clamp(NaN, 0, 5)).toBe(0);
  });
});

describe("consensusDimension", () => {
  it("applies bounded judge adjustment to the median", () => {
    const c = consensusDimension("centrality", [4, 5, 3], 0.5);
    expect(c.median).toBe(4);
    expect(c.final).toBe(4.5);
  });
  it("clamps adjustment to ±1 and result to 0–5", () => {
    expect(consensusDimension("hierarchy", [5, 5], 3).final).toBe(5);
    expect(consensusDimension("hierarchy", [4, 4], 3).final).toBe(5);
    expect(consensusDimension("hierarchy", [0.5, 0.5], -3).final).toBe(0);
  });
  it("treats a missing adjustment as zero", () => {
    expect(consensusDimension("modularity", [2, 3], undefined).final).toBe(2.5);
  });
});

describe("classifyMandala", () => {
  it("returns neither when both are low", () => {
    expect(classifyMandala(20, 30)).toBe("neither");
  });
  it("returns hybrid when both are high", () => {
    expect(classifyMandala(92, 63)).toBe("hybrid");
    expect(classifyMandala(70, 75)).toBe("hybrid");
  });
  it("returns the dominant type otherwise", () => {
    expect(classifyMandala(85, 20)).toBe("taizokai");
    expect(classifyMandala(30, 80)).toBe("kongokai");
  });
});
