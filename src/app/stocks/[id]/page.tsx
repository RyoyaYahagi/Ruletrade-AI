import Link from "next/link";
import { notFound } from "next/navigation";

import { ReviewForm } from "@/components/review-form";
import { TransactionForm } from "@/components/transaction-form";
import {
  getStock,
  listDecisions,
  listReviews,
  listTransactions,
} from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const kindLabel = {
  buy: "購入",
  add: "買い増し",
  sell: "売却",
  review: "見直し",
  note: "メモ",
} as const;

function money(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function StockPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const stock = getStock(id);
  if (!stock) notFound();

  const decisions = listDecisions(id);
  const transactions = listTransactions(id);
  const reviews = listReviews(id);
  const latestThesis = decisions.find((item) => item.thesis)?.thesis;

  return (
    <main className="shell">
      <header className="topbar">
        <Link className="back-link" href="/">← 一覧</Link>
        <p className="disclaimer">外部の株価・ニュースは参照せず、保存した自分の記録だけを比較します。</p>
      </header>

      <section className="stock-header">
        <div>
          <p className="eyebrow">STOCK JOURNAL</p>
          <h1>{stock.ticker} <span>{stock.name}</span></h1>
        </div>
        <div className="current-thesis">
          <span>現在表示している最新の投資理由</span>
          <p>{latestThesis || "まだ投資理由は記録されていません。"}</p>
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">COMPARE</p>
            <h2>今の考えを、過去の自分と比べる</h2>
          </div>
          <p className="muted">AIは過去との違いを整理するだけで、売買判断はしません。</p>
        </div>
        <ReviewForm stockId={id} />
      </section>

      <section className="content-section">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">DECISIONS</p>
            <h2>判断タイムライン</h2>
          </div>
          <span className="muted small">{decisions.length}件</span>
        </div>

        {decisions.length === 0 ? (
          <p className="empty">判断記録はまだありません。</p>
        ) : (
          <ol className="timeline">
            {decisions.map((decision) => (
              <li key={decision.id}>
                <div className="timeline-marker" />
                <div className="timeline-content">
                  <div className="timeline-meta">
                    <span className="kind">{kindLabel[decision.kind]}</span>
                    <time>{decision.createdAt}</time>
                    {decision.reviewAt && <span>見直し {decision.reviewAt}</span>}
                  </div>
                  <p className="raw-note">「{decision.rawText}」</p>
                  {decision.thesis && (
                    <div className="decision-block">
                      <strong>判断理由</strong>
                      <p>{decision.thesis}</p>
                    </div>
                  )}
                  <div className="decision-columns">
                    {decision.assumptions.length > 0 && (
                      <div>
                        <strong>前提</strong>
                        <ul>{decision.assumptions.map((x) => <li key={x}>{x}</li>)}</ul>
                      </div>
                    )}
                    {decision.exitConditions.length > 0 && (
                      <div>
                        <strong>売る・見直す条件</strong>
                        <ul>{decision.exitConditions.map((x) => <li key={x}>{x}</li>)}</ul>
                      </div>
                    )}
                    {decision.addConditions.length > 0 && (
                      <div>
                        <strong>買い増し条件</strong>
                        <ul>{decision.addConditions.map((x) => <li key={x}>{x}</li>)}</ul>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="content-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">TRADES</p>
            <h2>売買履歴</h2>
          </div>
          <p className="muted">証券会社連携はせず、判断に必要な事実だけ手入力します。</p>
        </div>

        <TransactionForm stockId={id} />

        {transactions.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>日付</th>
                  <th>売買</th>
                  <th>数量</th>
                  <th>価格</th>
                  <th>手数料</th>
                  <th>メモ</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((trade) => (
                  <tr key={trade.id}>
                    <td>{trade.tradedAt}</td>
                    <td>{trade.side === "buy" ? "買い" : "売り"}</td>
                    <td>{trade.quantity}</td>
                    <td>{money(trade.price)}</td>
                    <td>{money(trade.fees)}</td>
                    <td>{trade.reflection || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {reviews.length > 0 && (
        <section className="content-section">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">PAST REVIEWS</p>
              <h2>過去との比較履歴</h2>
            </div>
          </div>
          <div className="past-reviews">
            {reviews.map((review) => (
              <article key={review.id}>
                <time>{review.createdAt}</time>
                <p className="raw-note">「{review.currentText}」</p>
                <p>{review.comparison.summary}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
