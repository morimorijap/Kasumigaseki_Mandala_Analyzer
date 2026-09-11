import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-4 py-16 text-center">
      <h1 className="text-2xl font-bold">結果が見つかりません</h1>
      <p className="text-muted">URLが正しくないか、結果が削除された可能性があります。</p>
      <Link href="/" className="inline-block rounded-full bg-accent px-6 py-2 font-bold text-white">
        トップへ戻る
      </Link>
    </div>
  );
}
