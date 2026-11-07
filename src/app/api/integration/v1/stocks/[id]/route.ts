import { eq } from "drizzle-orm";

import {
  getStockTimelineAction,
  listReviewsForStockAction,
} from "@/features/decisions/actions";
import {
  authorizeIntegrationRequest,
  createMethodNotAllowedHandler,
} from "@/features/integration/auth";
import {
  toDecision,
  toHolding,
  toReview,
  toStock,
  toTransaction,
  type IntegrationTimelineItem,
} from "@/features/integration/mappers";
import {
  errorResponse,
  internalErrorResponse,
  successResponse,
} from "@/features/integration/responses";
import { listPortfolioAction } from "@/features/portfolio/actions";
import { japanDate } from "@/features/transactions/matching";
import { getDb } from "@/lib/db";
import { stocks } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const kindOrder = { decision: 0, transaction: 1, review: 2 } as const;

function timelineId(item: IntegrationTimelineItem): string {
  if (item.kind === "decision") return item.decision.id;
  if (item.kind === "transaction") return item.transaction.id;
  return item.review.id;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const authError = authorizeIntegrationRequest(request, "read");
    if (authError) return authError;

    const { id } = await context.params;
    const stockRow = getDb()
      .select()
      .from(stocks)
      .where(eq(stocks.id, id))
      .get();
    if (!stockRow) return errorResponse("not_found");

    const [timelineData, reviews, portfolio] = await Promise.all([
      getStockTimelineAction({ stockId: id }),
      listReviewsForStockAction({ stockId: id }),
      listPortfolioAction(),
    ]);
    const holding = portfolio.find((item) => item.stockId === id) ?? null;

    const timeline = [
      ...timelineData.decisions.map((decision) => ({
        kind: "decision" as const,
        occurredOn: japanDate(decision.decidedAt ?? decision.createdAt),
        occurredAt: decision.createdAt,
        decision: toDecision(decision),
      })),
      ...timelineData.transactions.map((transaction) => ({
        kind: "transaction" as const,
        occurredOn: japanDate(transaction.executedAt),
        occurredAt: transaction.executedAt,
        transaction: toTransaction(transaction),
      })),
      ...reviews.map((review) => ({
        kind: "review" as const,
        occurredOn: japanDate(review.createdAt),
        occurredAt: review.createdAt,
        review: toReview(review),
      })),
    ].sort(
      (a, b) =>
        a.occurredOn.localeCompare(b.occurredOn) ||
        a.occurredAt.localeCompare(b.occurredAt) ||
        kindOrder[a.kind] - kindOrder[b.kind] ||
        timelineId(a).localeCompare(timelineId(b)),
    );

    return successResponse({
      stock: toStock(stockRow),
      holding: holding === null ? null : toHolding(holding),
      counts: {
        decisions: timelineData.decisions.length,
        transactions: timelineData.transactions.length,
        reviews: reviews.length,
      },
      timeline,
    });
  } catch {
    return internalErrorResponse();
  }
}

const methodNotAllowed = createMethodNotAllowedHandler("read");

export {
  methodNotAllowed as POST,
  methodNotAllowed as PUT,
  methodNotAllowed as PATCH,
  methodNotAllowed as DELETE,
  methodNotAllowed as OPTIONS,
  methodNotAllowed as HEAD,
};
