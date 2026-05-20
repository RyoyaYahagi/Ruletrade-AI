import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Ruletrade-AI — 投資ルールを整理するAI補助アプリ",
  description:
    "AIが投資ルールの拘り抜け・おさらいを確認し、自分だけの利断基準を明文化する。投資助言ではありません。",
  openGraph: {
    title: "Ruletrade-AI",
    description: "投資ルールを整理するAI補助アプリ",
    url: "https://ruletrade-ai.vercel.app",
    siteName: "Ruletrade-AI",
    locale: "ja_JP",
    type: "website",
  },
};

export default function LandingPage() {
  return (
    <main className="flex flex-col">
      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          投資ルールを整理し、判断を明文化する
        </h1>
        <p className="mt-6 text-lg text-gray-600">
          Ruletrade-AIは、自分の投資ルールをセッション単位で作成・管理し、
          AIが拘り抜けやおさらいをフィードバックする補助ツールです。
        </p>
        <p className="mt-4 text-sm text-gray-500">
          ※投資助言、売買推奨、資産運用の代行ではありません。
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/login"
            className="rounded bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            ログイン
          </Link>
          <Link
            href="/signup"
            className="rounded border px-5 py-2.5 text-sm font-medium hover:bg-gray-50"
          >
            新規登録
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="text-2xl font-bold">まず使ってみる</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">投資ルールの作成</h3>
            <p className="mt-1 text-sm text-gray-600">
              セッション単位で自分の判断基準を言語化します。
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">AIフィードバック</h3>
            <p className="mt-1 text-sm text-gray-600">
              AIがルールの拘り抜けや矛盾を指摘します。
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">資料管理</h3>
            <p className="mt-1 text-sm text-gray-600">
              投資資料をアップロードして再利用できます。
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">ウォッチリスト</h3>
            <p className="mt-1 text-sm text-gray-600">
              気になる銘柄をリストアップして管理します。
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="text-2xl font-bold">よくある質問</h2>
        <dl className="mt-6 space-y-4">
          <div className="rounded border p-4">
            <dt className="font-medium">投資助言はしてくれますか？</dt>
            <dd className="mt-1 text-sm text-gray-600">
              いいえ。Ruletrade-AIは投資助言、売買推奨、資産運用の代行ではありません。あなた自身の判断基準を整理するツールです。
            </dd>
          </div>
          <div className="rounded border p-4">
            <dt className="font-medium">課金はありますか？</dt>
            <dd className="mt-1 text-sm text-gray-600">
              Closed Beta期間中は無料でご利用いただけます。
            </dd>
          </div>
          <div className="rounded border p-4">
            <dt className="font-medium">データは安全ですか？</dt>
            <dd className="mt-1 text-sm text-gray-600">
              ユーザーデータは暗号化されて保存され、貴方だけがアクセスできます。
            </dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
