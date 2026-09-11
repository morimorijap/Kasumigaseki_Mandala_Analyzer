/**
 * KMI rubric v1 — see docs/kasumigaseki_mandala_analyzer_spec.md §3.
 * LLMs score each dimension 0–5; the weighted 0–100 conversion lives in kmi.ts.
 */

export const RUBRIC_VERSION = "kmi-v1";

export const DIMENSION_KEYS = [
  "centrality",
  "hierarchy",
  "relation_density",
  "information_density",
  "semantic_breadth",
  "modularity",
  "radial_or_grid_structure",
  "visual_coding",
  "world_closure",
] as const;

export type DimensionKey = (typeof DIMENSION_KEYS)[number];

export type RubricDimension = {
  key: DimensionKey;
  maxPoints: number;
  label: string;
  definition: string;
};

export const RUBRIC: readonly RubricDimension[] = [
  {
    key: "centrality",
    maxPoints: 15,
    label: "中心性",
    definition: "中央・主題となる核が視覚的/意味的に存在するか",
  },
  {
    key: "hierarchy",
    maxPoints: 15,
    label: "階層性",
    definition: "中心→周辺、上位→下位など多層構造があるか",
  },
  {
    key: "relation_density",
    maxPoints: 15,
    label: "関係密度",
    definition: "矢印・線・因果・循環・連携関係が密か",
  },
  {
    key: "information_density",
    maxPoints: 15,
    label: "情報密度",
    definition: "テキスト、図形、写真、アイコン等の占有密度",
  },
  {
    key: "semantic_breadth",
    maxPoints: 10,
    label: "意味領域の広さ",
    definition: "異なる政策領域・主体・概念を一枚に統合しているか",
  },
  {
    key: "modularity",
    maxPoints: 10,
    label: "群構造",
    definition: "色付き領域、箱、サブシステム等の群構造・反復",
  },
  {
    key: "radial_or_grid_structure",
    maxPoints: 8,
    label: "放射／格子構造",
    definition: "放射・同心円・グリッド等の強い空間秩序",
  },
  {
    key: "visual_coding",
    maxPoints: 6,
    label: "視覚的符号化",
    definition: "色・枠・アイコン・形状による多重符号化",
  },
  {
    key: "world_closure",
    maxPoints: 6,
    label: "世界の閉鎖性",
    definition: "「この一枚ですべてを説明する」閉じた世界観の強さ",
  },
] as const;

export const RUBRIC_MAX_TOTAL = RUBRIC.reduce((sum, d) => sum + d.maxPoints, 0); // 100

export const RUBRIC_BY_KEY: Record<DimensionKey, RubricDimension> = Object.fromEntries(
  RUBRIC.map((d) => [d.key, d]),
) as Record<DimensionKey, RubricDimension>;

export type Grade =
  | "非曼荼羅"
  | "ポンチ絵"
  | "準曼荼羅"
  | "霞ヶ関曼荼羅"
  | "濃厚霞ヶ関曼荼羅"
  | "極密霞ヶ関曼荼羅";

export const GRADE_BANDS: readonly { min: number; grade: Grade }[] = [
  { min: 90, grade: "極密霞ヶ関曼荼羅" },
  { min: 80, grade: "濃厚霞ヶ関曼荼羅" },
  { min: 60, grade: "霞ヶ関曼荼羅" },
  { min: 40, grade: "準曼荼羅" },
  { min: 20, grade: "ポンチ絵" },
  { min: 0, grade: "非曼荼羅" },
];

/** Rubric rendered as text for prompts (kept in sync with the table above). */
export function rubricAsText(): string {
  return RUBRIC.map(
    (d) => `- ${d.key} (max ${d.maxPoints}, 「${d.label}」): ${d.definition}`,
  ).join("\n");
}
