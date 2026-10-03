import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getStockTimelineAction } from "@/features/decisions/actions";
import {
  decisionTypeLabel,
  shortJapanDate,
} from "@/features/decisions/decision-display";
import { CompareForm } from "@/features/reviews/compare-form";

export const dynamic = "force-dynamic";

export default async function StockReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ decision?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  let data;
  try {
    data = await getStockTimelineAction({ stockId: id });
  } catch {
    notFound();
  }
  const reviewDecision = query.decision
    ? data.decisions.find((decision) => decision.id === query.decision)
    : undefined;
  if (query.decision && !reviewDecision) notFound();
  // 比較 API は銘柄の過去の記録すべてと比べる。特定の判断を選んでいない場合は最新の記録を手がかりとして見せる。
  const shownDecision = reviewDecision ?? data.decisions.at(-1);

  return (
    <main className="page-shell space-y-6">
      <div className="space-y-3">
        <Link
          href={`/stocks/${id}`}
          className="-ml-1 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground"
        >
          <ArrowLeft aria-hidden size={18} />
          {data.stock.name}の記録
        </Link>
        <h1 className="page-title">振り返り</h1>
        <p className="text-sm text-muted-foreground">
          いまの考えを書くと、AIが{data.stock.name}の過去の記録との違いを整理します。
        </p>
      </div>

      {shownDecision ? (
        <section className="space-y-2" aria-labelledby="then-heading">
          <h2 id="then-heading" className="section-label">
            {reviewDecision ? "振り返る判断" : "最後の記録"}
            <span className="ml-1 font-mono font-medium">
              · {shortJapanDate(shownDecision.decidedAt ?? shownDecision.createdAt)}{" "}
              {decisionTypeLabel[shownDecision.type]}
            </span>
          </h2>
          <div className="surface space-y-4 p-5">
            <p className="journal-text whitespace-pre-wrap text-[17px]">
              「{shownDecision.rawInput}」
            </p>
            {shownDecision.reviewConditions.length > 0 && (
              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-muted-foreground">
                  当時決めた、考え直す条件
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-7">
                  {shownDecision.reviewConditions.map((condition, index) => (
                    <li key={index}>{condition}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      ) : (
        <p className="surface p-5 text-sm text-muted-foreground">
          この銘柄の判断メモはまだありません。比較はできますが、違いは見つかりにくくなります。
        </p>
      )}

      <CompareForm stock={data.stock} reviewDecision={reviewDecision ?? null} />
    </main>
  );
}
