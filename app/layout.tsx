import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const notoSansJp = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "霞ヶ関曼荼羅 Analyzer",
  description:
    "画像を貼り付けると、霞ヶ関曼荼羅度（KMI）・胎蔵界型/金剛界型との形式的類似度・可読性を複数のVision LLMで分析します。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${notoSansJp.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-border bg-card/70 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-bold tracking-wide">
              <span className="inline-block h-6 w-6 rounded-full border-4 border-accent" aria-hidden />
              霞ヶ関曼荼羅 Analyzer
            </Link>
            <nav className="text-sm text-muted">
              <Link href="/about" className="hover:text-foreground">
                この指標について
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-border px-4 py-6 text-center text-xs text-muted">
          <p>
            「曼荼羅」は宗教的価値の評価ではなく、中心・階層・反復・群構造・世界の一枚化といった空間構成の形式的参照モデルです。
            KMIは資料の品質評価ではありません。
          </p>
          <p className="mt-1">画像は非公開ストレージに保存され、公開の一覧は存在しません。氏名・メールアドレス等は収集しません（同一ブラウザの履歴表示用に匿名IDのみ保存します）。</p>
        </footer>
      </body>
    </html>
  );
}
