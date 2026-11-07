import { desc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import {
  mapDecisionRow,
  mapStockRow,
} from "@/features/decisions/decision-mapper";
import { japanDate } from "@/features/transactions/matching";
import { getDb } from "@/lib/db";
import { decisions, stocks, transactions } from "@/lib/db/schema";
import { DecisionSchema } from "@/schemas/decision";
import { StockSchema } from "@/schemas/stock";
import { TransactionSchema } from "@/schemas/transaction";

import type { Decision } from "@/schemas/decision";
import type { Stock } from "@/schemas/stock";
import type { Transaction } from "@/schemas/transaction";

export type DueStock = Stock & { marketCode: string | null };

export type DueDecision = {
  stock: DueStock;
  decision: Decision;
  dueReviewAt: string;
  dueOn: string;
};

export type DueTransaction = {
  stock: DueStock;
  transaction: Transaction;
};

function mapDueStock(row: typeof stocks.$inferSelect): DueStock {
  return {
    ...StockSchema.parse(mapStockRow(row)),
    marketCode: row.marketCode,
  };
}

/**
 * The web screen and the integration API share one due rule: after the latest
 * review, the earliest scheduled date at or before asOf. The original
 * decision.reviewAt stays untouched; the adopted date is exposed separately.
 */
export async function listDueDecisions(
  asOf = new Date().toISOString(),
): Promise<DueDecision[]> {
  const cutoff = new Date(asOf).toISOString();
  const rows = getDb()
    .select({
      stock: stocks,
      decision: decisions,
      latestReviewAt: sql<
        string | null
      >`(select max(created_at) from reviews where decision_id = ${decisions.id})`,
    })
    .from(decisions)
    .innerJoin(stocks, eq(decisions.stockId, stocks.id))
    .where(isNotNull(decisions.reviewAt))
    .all();
  return rows
    .flatMap(({ stock, decision: row, latestReviewAt }) => {
      const decision = DecisionSchema.parse(mapDecisionRow(row));
      const dueReviewAt = (decision.reviewDates ?? [])
        .filter(
          (date) =>
            date <= cutoff && (!latestReviewAt || date > latestReviewAt),
        )
        .sort()[0];
      return dueReviewAt
        ? [
            {
              stock: mapDueStock(stock),
              decision,
              dueReviewAt,
              dueOn: japanDate(dueReviewAt),
            },
          ]
        : [];
    })
    .sort((a, b) => a.dueReviewAt.localeCompare(b.dueReviewAt));
}

export async function listUnlinkedTransactions(): Promise<DueTransaction[]> {
  return getDb()
    .select({ stock: stocks, transaction: transactions })
    .from(transactions)
    .innerJoin(stocks, eq(transactions.stockId, stocks.id))
    .where(isNull(transactions.decisionId))
    .orderBy(desc(transactions.executedAt))
    .all()
    .map(({ stock, transaction }) => ({
      stock: mapDueStock(stock),
      transaction: TransactionSchema.parse(transaction),
    }));
}
