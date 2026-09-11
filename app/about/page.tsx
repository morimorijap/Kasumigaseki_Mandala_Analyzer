import { RUBRIC, GRADE_BANDS } from "@/lib/scoring/rubric";

export const metadata = { title: "この指標について — 霞ヶ関曼荼羅 Analyzer" };

export default function AboutPage() {
  return (
    <article className="prose-sm max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">この指標について</h1>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">霞ヶ関曼荼羅度（KMI）</h2>
        <p>
          官公庁・審議会・政策資料に見られる、一枚に世界を閉じ込めた高密度な概念図（いわゆる「霞ヶ関曼荼羅」「ポンチ絵」）の
          情報構造を、中心・階層・反復・群構造・世界の一枚化といった形式的特徴で数値化した設計尺度です。
          9つの評価軸を複数の Vision LLM が 0–5 で採点し、中央値と Judge の補正（±1.0 以内）をもとにコード側で 0–100 に換算します。
        </p>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="py-1 pr-2">評価軸</th>
              <th className="py-1 pr-2 text-right">配点</th>
              <th className="py-1">定義</th>
            </tr>
          </thead>
          <tbody>
            {RUBRIC.map((d) => (
              <tr key={d.key} className="border-t border-border">
                <td className="py-1 pr-2">
                  {d.label} <span className="font-mono text-xs text-muted">{d.key}</span>
                </td>
                <td className="py-1 pr-2 text-right tabular-nums">{d.maxPoints}</td>
                <td className="py-1">{d.definition}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="font-mono text-xs text-muted">KMI = Σ(max_points_i × raw_score_i / 5)</p>
        <p className="text-sm">
          グレード:{" "}
          {[...GRADE_BANDS]
            .reverse()
            .map((b) => `${b.min}〜 ${b.grade}`)
            .join(" / ")}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">胎蔵界型 / 金剛界型</h2>
        <p>
          東京国立博物館「空海と密教美術展」の両界曼荼羅解説を、<strong>形式的な構造モデル</strong>として参照しています。
          胎蔵界型は「明確な中心核から周囲へ展開し、複数の領域が中心を囲む」構成、金剛界型は「独立した区画が格子状に反復し、
          部分世界の集合として全体を構成する」構成です。宗教美術としての真贋・教義的正しさは判定しません。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">可読性は別指標</h2>
        <p>
          高KMI＝悪い資料ではありません。文字サイズ、余白、読む順序、矢印の交差、コントラスト、色分けの一貫性、主要メッセージの発見容易性を
          0–100 で別途評価します。典型的な霞ヶ関曼荼羅は「KMI 高・可読性 低」になりがちですが、両者は独立に扱います。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">ハルシネーション対策</h2>
        <ul className="list-disc pl-5">
          <li>判読不能な文字は推測せず「判読不能」として記録します</li>
          <li>作成省庁・作者・政策意図・政治的立場は画像に根拠がない限り推測しません</li>
          <li>合計点は LLM ではなく TypeScript で計算します</li>
          <li>Judge は画像上の根拠がある場合のみ ±1.0 の補正を提案できます</li>
          <li>画像処理による決定論的特徴（余白率・エッジ密度・色エントロピー等）を証拠として併用します</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">プライバシー</h2>
        <p>
          ユーザー登録はありません。ブラウザにランダムな匿名IDを保存し、同じブラウザの最近の解析を表示するためだけに使います。
          アップロード画像は送信前にブラウザで最大 2048px に縮小され、サーバーでメタデータを除去・再エンコードして非公開ストレージに保存されます。公開の一覧・画像URLは存在しません。
        </p>
      </section>

      <section className="space-y-1 text-sm text-muted">
        <h2 className="text-lg font-bold text-foreground">参考</h2>
        <p>東京国立博物館「空海と密教美術展」ジュニアガイド</p>
        <p>文春オンライン「“霞が関曼荼羅”の伝統はいつまで続く？」</p>
      </section>
    </article>
  );
}
