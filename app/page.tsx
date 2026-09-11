import { ImageDropzone } from "@/components/image-dropzone";
import { RecentAnalyses } from "@/components/recent-analyses";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="space-y-3 text-center">
        <h1 className="text-3xl font-bold tracking-wide sm:text-4xl">霞ヶ関曼荼羅 Analyzer</h1>
        <p className="mx-auto max-w-2xl text-muted">
          官公庁・審議会・政策資料に見られる「霞ヶ関曼荼羅」的な情報構造を、複数の Vision LLM と決定論的画像特徴で分析し、
          <strong className="text-foreground">霞ヶ関曼荼羅度（KMI）</strong>・胎蔵界型/金剛界型との形式的類似度・可読性を返します。
        </p>
      </section>

      <ImageDropzone />

      <RecentAnalyses />

      <section className="grid gap-4 text-sm text-muted sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-1 font-bold text-foreground">KMI 0–100</h3>
          中心性・階層性・関係密度・情報密度など9軸を各LLMが0–5で採点し、合計はコード側で算出します。
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-1 font-bold text-foreground">胎蔵界型 / 金剛界型</h3>
          単一中心から放射する構成か、格子状のモジュール反復か。両界曼荼羅を形式的な参照モデルとして比較します。
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-1 font-bold text-foreground">可読性は別指標</h3>
          高KMI＝悪い資料ではありません。読みやすさは曼荼羅度とは独立に評価します。
        </div>
      </section>
    </div>
  );
}
