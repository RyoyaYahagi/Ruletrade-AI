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

export async function createTransactionAction(
  input: unknown,
): Promise<Transaction> {
  const parsed = CreateTransactionInputSchema.parse(input);
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  const executedAt = parsed.executedAt;
  db.transaction((tx) => {
    const stock = tx
      .select({ id: stocks.id })
      .from(stocks)
      .where(eq(stocks.id, parsed.stockId))
      .get();
    if (!stock) throw new Error("Stock not found");
    if (parsed.decisionId) {
      const decision = tx
        .select({ stockId: decisions.stockId })
        .from(decisions)
        .where(
          and(
            eq(decisions.id, parsed.decisionId),
            eq(decisions.stockId, parsed.stockId),
          ),
        )
        .get();
      if (!decision)
        throw new Error(
          "Transaction decision must belong to the selected stock",
        );
    }
    tx.insert(transactions)
      .values({
        ...parsed,
        id,
        executedAt,
        decisionId: parsed.decisionId ?? null,
        createdAt: now,
      })
      .run();
  });
  return TransactionSchema.parse({
    ...parsed,
    id,
    executedAt,
    decisionId: parsed.decisionId ?? null,
    createdAt: now,
  });
}

export async function linkTransactionDecisionAction(
  input: unknown,
): Promise<void> {
  const parsed = TransactionSchema.pick({ id: true, decisionId: true }).parse(
    input,
  );
  getDb().transaction((tx) => {
    const transaction = tx
      .select()
      .from(transactions)
      .where(eq(transactions.id, parsed.id))
      .get();
    if (!transaction) throw new Error("売買履歴が見つかりません。");
    if (parsed.decisionId) {
      const decision = tx
        .select()
        .from(decisions)
        .where(eq(decisions.id, parsed.decisionId))
        .get();
      if (!decision || decision.stockId !== transaction.stockId) {
        throw new Error("同じ銘柄の判断メモを選択してください。");
      }
    }
    tx.update(transactions)
      .set({ decisionId: parsed.decisionId })
      .where(eq(transactions.id, parsed.id))
      .run();
  });
}
