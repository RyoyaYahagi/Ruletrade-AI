import { desc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import {
  mapDecisionRow,
  mapStockRow,
} from "@/features/decisions/decision-mapper";
import { getDb } from "@/lib/db";
import { decisions, stocks, transactions } from "@/lib/db/schema";
import { DecisionSchema } from "@/schemas/decision";
import { StockSchema } from "@/schemas/stock";
import { TransactionSchema } from "@/schemas/transaction";

import type { Decision } from "@/schemas/decision";
import type { Stock } from "@/schemas/stock";
import type { Transaction } from "@/schemas/transaction";

export type DueDecision = {
  stock: Stock;
  decision: Decision;
};

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
      const dueDate = decision.reviewDates
        ?.filter(
          (date) =>
            date <= cutoff && (!latestReviewAt || date > latestReviewAt),
        )
        .sort()[0];
      return dueDate
        ? [
            {
              stock: StockSchema.parse(mapStockRow(stock)),
              decision: { ...decision, reviewAt: dueDate },
            },
          ]
        : [];
    })
    .sort((a, b) => a.decision.reviewAt.localeCompare(b.decision.reviewAt));
}

export async function listUnlinkedTransactions(): Promise<Transaction[]> {
  return getDb()
    .select()
    .from(transactions)
    .where(isNull(transactions.decisionId))
    .orderBy(desc(transactions.executedAt))
    .all()
    .map((row) => TransactionSchema.parse(row));
}
