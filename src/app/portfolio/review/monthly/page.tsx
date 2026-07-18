import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/get-current-user";
import { listRuleSessions } from "@/features/rules/services/rule-session-service";
import { listHolisticReviews } from "@/features/portfolio/services/holistic-review-service";

const categoryLabels: Record<string, string> = {
  risk_tolerance_mismatch: "リスク許容度",
  missing_rule: "ルール未設定",
  missing_exit: "出口条件",
  concentration: "集中",
  constraint_check: "制約確認",
  stale_rule: "レビュー期限",
};

export default async function MonthlyReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { period } = await searchParams;
  const [{ reviews }, { sessions }] = await Promise.all([
    listHolisticReviews({ userId: user.id, period }),
    listRuleSessions({ userId: user.id }),
  ]);
  const selectedReview = reviews[0] ?? null;
  const sessionByTicker = new Map(
    sessions.map((session) => [session.ticker, session.id]),
  );

  return (
    <main className="mx-auto max-w-4xl px-5 py-8 sm:px-8" data-testid="monthly-review-page">
      <nav className="flex flex-wrap gap-3 text-sm text-muted-foreground" aria-label="メインナビゲーション">
        <Link href="/today" className="underline-offset-4 hover:underline">Today</Link>
        <Link href="/rules" className="underline-offset-4 hover:underline">ルール体系</Link>
        <Link href="/portfolio" className="underline-offset-4 hover:underline">ポートフォリオ</Link>
      </nav>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Monthly review</p>
          <h1 className="mt-2 text-3xl font-semibold">月次総合レビュー</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            このレビューは、あなたが登録した情報とルールの整合を確認するものです。売買の推奨ではありません。
          </p>
        </div>
        <form method="get" className="flex items-center gap-2">
          <label htmlFor="review-period" className="text-sm font-medium">期間</label>
          <select id="review-period" name="period" defaultValue={period ?? reviews[0]?.period ?? ""} className="rounded-md border bg-background px-3 py-2 text-base">
            <option value="">すべて</option>
            {reviews.map((review) => (
              <option key={review.period} value={review.period}>{review.period}</option>
            ))}
          </select>
          <button type="submit" className="rounded-md border px-3 py-2 text-base">表示</button>
        </form>
      </div>

      {!selectedReview ? (
        <section className="mt-8 rounded-xl border border-dashed p-8 text-center">
          <h2 className="text-xl font-semibold">まだ月次レビューはありません</h2>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            保有銘柄があり、通知設定が有効なユーザーを対象に、毎日の処理で生成されます。
          </p>
        </section>
      ) : (
        <section className="mt-8 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">{selectedReview.period} の確認事項</h2>
            <span className="rounded-full border px-3 py-1 text-sm">
              {selectedReview.safetyPassed ? "安全性確認済み" : "安全な表示に差し替え済み"}
            </span>
          </div>

          <div className="rounded-xl border bg-muted/20 p-5">
            <p className="text-base leading-7">{selectedReview.review.overallNote}</p>
          </div>

          {selectedReview.review.changedFromLastMonth ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-5">
              <p className="text-sm font-medium text-muted-foreground">前月からの変化</p>
              <p className="mt-2 text-base leading-7">{selectedReview.review.changedFromLastMonth}</p>
              <p className="mt-2 text-xs text-muted-foreground">あなたの過去のメモ・判断からの比較です。</p>
            </div>
          ) : null}

          <div className="grid gap-4">
            {selectedReview.review.findings.map((finding, index) => (
              <article
                key={`${finding.category}-${index}`}
                className={`rounded-xl border p-5 ${finding.status === "ok" ? "border-emerald-200 bg-emerald-50/70" : "border-amber-200 bg-amber-50/70"}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    {categoryLabels[finding.category] ?? finding.category}
                  </span>
                  <span className="rounded-full border px-2 py-1 text-sm font-medium">
                    {finding.status === "ok" ? "守れています" : "確認してください"}
                  </span>
                </div>
                <p className="mt-3 text-base leading-7">{finding.message}</p>
                {finding.relatedSymbols.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {finding.relatedSymbols.map((symbol) => {
                      const sessionId = sessionByTicker.get(symbol);
                      return sessionId ? (
                        <Link key={symbol} href={`/rules/${sessionId}`} className="rounded-md border bg-background px-3 py-2 text-base underline-offset-4 hover:underline">
                          {symbol} の関連ルールを開く
                        </Link>
                      ) : (
                        <span key={symbol} className="rounded-md border bg-background px-3 py-2 text-base">{symbol}</span>
                      );
                    })}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      )}

      {reviews.length > 1 ? (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">過去の月次レビュー</h2>
          <div className="mt-3 divide-y rounded-xl border">
            {reviews.map((review) => (
              <Link
                key={review.id}
                href={`/portfolio/review/monthly?period=${encodeURIComponent(review.period)}`}
                className="flex items-center justify-between gap-3 px-4 py-3 text-base hover:bg-muted/40"
              >
                <span>{review.period}</span>
                <span className="text-sm text-muted-foreground">詳細を表示 →</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
