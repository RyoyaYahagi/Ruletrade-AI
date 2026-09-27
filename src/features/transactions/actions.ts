"use server";

import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { decisions, stocks, transactions } from "@/lib/db/schema";
import {
  ConfirmedTransactionInputSchema,
  TransactionSchema,
} from "@/schemas/transaction";

import type { Transaction } from "@/schemas/transaction";

const CreateTransactionInputSchema = ConfirmedTransactionInputSchema.extend({
  stockId: TransactionSchema.shape.stockId,
  decisionId: TransactionSchema.shape.decisionId.optional(),
});

export async function listTransactionsAction(): Promise<Transaction[]> {
  return getDb()
    .select()
    .from(transactions)
    .orderBy(desc(transactions.executedAt))
    .all()
    .map((row) => TransactionSchema.parse(row));
}

export async function createTransactionAction(input: unknown): Promise<Transaction> {
  const parsed = CreateTransactionInputSchema.parse(input);
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  const executedAt = parsed.executedAt;
  db.transaction((tx) => {
    const stock = tx.select({ id: stocks.id }).from(stocks).where(eq(stocks.id, parsed.stockId)).get();
    if (!stock) throw new Error("Stock not found");
    if (parsed.decisionId) {
      const decision = tx
        .select({ stockId: decisions.stockId })
        .from(decisions)
        .where(and(eq(decisions.id, parsed.decisionId), eq(decisions.stockId, parsed.stockId)))
        .get();
      if (!decision) throw new Error("Transaction decision must belong to the selected stock");
    }
    tx.insert(transactions)
      .values({ ...parsed, id, executedAt, decisionId: parsed.decisionId ?? null, createdAt: now })
      .run();
  });
  return TransactionSchema.parse({ ...parsed, id, executedAt, createdAt: now });
}
