import Link from "next/link";

import { CapturePanel } from "@/components/capture-panel";
import { listStocks, listUpcomingReviews } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function reviewState(reviewAt: string) {
  const today = new Date().toISOString().slice(0, 10);
  if (reviewAt < today) return "期限超過";
  if (reviewAt === today) return "今日";
  return reviewAt;
}

export default function HomePage() {
  const stocks = listStocks();
  const reviews = listUpcomingReviews();

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="brand">Ruletrade-AI</p>
          <p className="muted small">Investment decision journal</p>
        </div>
        <p className="disclaimer">AIは売買を推奨せず、あなた自身の過去の判断整理にだけ使います。</p>
      </header>

      <section className="hero">
        <p className="eyebrow">REMEMBER THE REASON</p>
        <h1>買った理由を、未来の自分が忘れないために。</h1>
        <p>
          売買ルールを完成させるアプリではありません。その時なぜ判断したかを雑に残し、
          後から「当時の自分」と比較するための小さな記録帳です。
        </p>
      </section>

      <CapturePanel />

      <div className="dashboard-grid">
        <section>
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">STOCKS</p>
              <h2>銘柄</h2>
            </div>
            <span className="muted small">{stocks.length}件</span>
          </div>

          {stocks.length === 0 ? (
            <p className="empty">まだ記録がありません。上から最初の判断を残してください。</p>
          ) : (
            <div className="stock-list">
              {stocks.map((stock) => (
                <Link className="stock-row" href={`/stocks/${stock.id}`} key={stock.id}>
                  <div className="stock-code">
                    <strong>{stock.ticker}</strong>
                    <span>{stock.name || "銘柄名未設定"}</span>
                  </div>
                  <p>{stock.latestThesis || "まだ投資理由の要約はありません。"}</p>
                  <div className="stock-position">
                    <span className="muted small">保有数量</span>
                    <strong>{stock.position}</strong>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">REVIEW</p>
              <h2>見直し予定</h2>
            </div>
          </div>

          {reviews.length === 0 ? (
            <p className="empty">見直し日はまだ設定されていません。</p>
          ) : (
            <div className="review-list">
              {reviews.map((item) => (
                <Link href={`/stocks/${item.stockId}`} key={item.id}>
                  <span className="review-date">{reviewState(item.reviewAt)}</span>
                  <strong>{item.ticker}</strong>
                  <span>{item.thesis || "判断を見直す"}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
