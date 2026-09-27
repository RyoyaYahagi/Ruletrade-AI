"use server";

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, isNotNull, lte, notExists } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { decisions, reviews, stocks, transactions } from "@/lib/db/schema";
import { DecisionExtractionSchema, DecisionSchema } from "@/schemas/decision";
import { ReviewSchema } from "@/schemas/review";
import { StockSchema } from "@/schemas/stock";
import {
  ConfirmedTransactionInputSchema,
  TransactionSchema,
} from "@/schemas/transaction";
import { mapDecisionRow } from "@/features/decisions/decision-mapper";

import type { Decision } from "@/schemas/decision";
import type { Review } from "@/schemas/review";
import type { Stock } from "@/schemas/stock";
import type { Transaction } from "@/schemas/transaction";
import type { AppDatabase } from "@/lib/db";

type AppDatabaseTransaction = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

const SaveDecisionInputSchema = DecisionExtractionSchema.extend({
  rawInput: DecisionSchema.shape.rawInput,
  transcript: DecisionSchema.shape.transcript.optional(),
  followUpAnswer: DecisionSchema.shape.followUpAnswer.optional(),
  stockId: DecisionSchema.shape.stockId.optional(),
  reviewAt: DecisionSchema.shape.reviewAt.optional(),
  transactionInput: ConfirmedTransactionInputSchema.nullable().optional(),
});

const SaveReviewInputSchema = ReviewSchema.pick({
  stockId: true,
  decisionId: true,
  currentInput: true,
  summary: true,
  differences: true,
  reflection: true,
});

export async function saveDecisionAction(input: unknown): Promise<{
  success: true;
  stockId: string;
  decisionId: string;
  transactionId: string | null;
}> {
  const parsed = SaveDecisionInputSchema.parse(input);
  const db = getDb();
  const now = new Date().toISOString();
  const result = db.transaction((tx) => {
    let stock: Stock;
    if (parsed.stockId) {
      const existing = tx.select().from(stocks).where(eq(stocks.id, parsed.stockId)).get();
      if (!existing) throw new Error("Stock not found");
      stock = StockSchema.parse(mapStockRow(existing));
    } else {
      const existing = findMatchingStock(tx, parsed.stock.ticker, parsed.stock.name);
      if (existing) {
        stock = StockSchema.parse(mapStockRow(existing));
      } else {
        const stockRow = {
          id: randomUUID(),
          ticker: normalizeTicker(parsed.stock.ticker),
          name: parsed.stock.name.trim(),
          normalizedName: normalizeName(parsed.stock.name),
          market: parsed.stock.market,
          createdAt: now,
        };
        tx.insert(stocks).values(stockRow).run();
        stock = StockSchema.parse({
          id: stockRow.id,
          ticker: stockRow.ticker,
          name: stockRow.name,
          market: stockRow.market,
          createdAt: now,
        });
      }
    }

    const decisionId = randomUUID();
    tx.insert(decisions)
      .values({
        id: decisionId,
        stockId: stock.id,
        type: parsed.type,
        rawInput: parsed.rawInput,
        transcript: parsed.transcript ?? null,
        followUpAnswer: parsed.followUpAnswer ?? null,
        thesis: parsed.thesis,
        assumptions: JSON.stringify(parsed.assumptions),
        reviewConditions: JSON.stringify(parsed.reviewConditions),
        addConditions: JSON.stringify(parsed.addConditions),
        reviewAt: parsed.reviewAt ?? null,
        createdAt: now,
      })
      .run();

    const proposedTransaction = parsed.transactionInput === undefined
      ? parsed.transaction
      : parsed.transactionInput;
    const confirmedTransaction = proposedTransaction?.quantity == null || proposedTransaction.executedAt == null
      ? null
      : proposedTransaction;
    let transactionId: string | null = null;
    if (confirmedTransaction) {
      const trade = ConfirmedTransactionInputSchema.parse(confirmedTransaction);
      transactionId = randomUUID();
      tx.insert(transactions)
        .values({
          id: transactionId,
          stockId: stock.id,
          side: trade.side,
          quantity: trade.quantity,
          price: trade.price,
          fee: trade.fee,
          executedAt: trade.executedAt,
          decisionId,
          createdAt: now,
        })
        .run();
    }
    return { stockId: stock.id, decisionId, transactionId };
  });

  return { success: true, ...result };
}

export async function listStocksAction(): Promise<Stock[]> {
  const rows = getDb().select().from(stocks).orderBy(asc(stocks.name)).all();
  return rows.map((row) => StockSchema.parse(mapStockRow(row)));
}

export async function listRecentDecisionsAction(input: { limit?: number } = {}): Promise<Array<{
  stock: Stock;
  decision: Decision;
}>> {
  const limit = input.limit ?? 10;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("Limit must be an integer between 1 and 100");
  }
  const rows = getDb()
    .select({ stock: stocks, decision: decisions })
    .from(decisions)
    .innerJoin(stocks, eq(decisions.stockId, stocks.id))
    .orderBy(desc(decisions.createdAt))
    .limit(limit)
    .all();
  return rows.map(({ stock, decision }) => ({
    stock: StockSchema.parse(mapStockRow(stock)),
    decision: DecisionSchema.parse(mapDecisionRow(decision)),
  }));
}

export async function listDueDecisionsAction(): Promise<Array<{
  stock: Stock;
  decision: Decision;
}>> {
  return listReviewsDueAction();
}

export async function getStockTimelineAction(input: { stockId: string }): Promise<{
  stock: Stock;
  decisions: Decision[];
  transactions: Transaction[];
}> {
  const db = getDb();
  const stockRow = db.select().from(stocks).where(eq(stocks.id, input.stockId)).get();
  if (!stockRow) throw new Error("Stock not found");
  const decisionRows = db
    .select()
    .from(decisions)
    .where(eq(decisions.stockId, input.stockId))
    .orderBy(asc(decisions.createdAt))
    .all();
  const transactionRows = db
    .select()
    .from(transactions)
    .where(eq(transactions.stockId, input.stockId))
    .orderBy(desc(transactions.executedAt))
    .all();
  return {
    stock: StockSchema.parse(mapStockRow(stockRow)),
    decisions: decisionRows.map((row) => DecisionSchema.parse(mapDecisionRow(row))),
    transactions: transactionRows.map((row) => TransactionSchema.parse(row)),
  };
}

export async function listReviewsDueAction(asOf = new Date().toISOString()): Promise<Array<{
  stock: Stock;
  decision: Decision;
}>> {
  const rows = getDb()
    .select({ stock: stocks, decision: decisions })
    .from(decisions)
    .innerJoin(stocks, eq(decisions.stockId, stocks.id))
    .where(
      and(
        isNotNull(decisions.reviewAt),
        lte(decisions.reviewAt, asOf),
        notExists(
          getDb()
            .select({ id: reviews.id })
            .from(reviews)
            .where(
              and(
                eq(reviews.decisionId, decisions.id),
                gte(reviews.createdAt, decisions.reviewAt),
              ),
            ),
        ),
      ),
    )
    .orderBy(asc(decisions.reviewAt))
    .all();
  return rows.map(({ stock, decision }) => ({
    stock: StockSchema.parse(mapStockRow(stock)),
    decision: DecisionSchema.parse(mapDecisionRow(decision)),
  }));
}

export async function saveReviewAction(input: unknown): Promise<Review> {
  const parsed = SaveReviewInputSchema.parse(input);
  const db = getDb();
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.transaction((tx) => {
    const stock = tx.select({ id: stocks.id }).from(stocks).where(eq(stocks.id, parsed.stockId)).get();
    if (!stock) throw new Error("Stock not found");
    if (parsed.decisionId) {
      const decision = tx
        .select({ stockId: decisions.stockId })
        .from(decisions)
        .where(eq(decisions.id, parsed.decisionId))
        .get();
      if (!decision || decision.stockId !== parsed.stockId) {
        throw new Error("Review decision must belong to the selected stock");
      }
    }
    tx.insert(reviews)
      .values({
        ...parsed,
        id,
        differences: JSON.stringify(parsed.differences),
        createdAt,
      })
      .run();
  });
  return ReviewSchema.parse({ ...parsed, id, createdAt });
}

export async function listReviewsForStockAction(input: { stockId: string }): Promise<Review[]> {
  const rows = getDb()
    .select()
    .from(reviews)
    .where(eq(reviews.stockId, input.stockId))
    .orderBy(asc(reviews.createdAt))
    .all();
  return rows.map((row) =>
    ReviewSchema.parse({
      ...row,
      differences: parseStringArray(row.differences),
    }),
  );
}

function normalizeName(name: string) {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ja-JP");
}

function normalizeTicker(ticker: string | null) {
  return ticker?.trim().toLocaleUpperCase("en-US") || null;
}

function findMatchingStock(
  tx: AppDatabaseTransaction,
  ticker: string | null,
  name: string,
) {
  const normalizedTicker = normalizeTicker(ticker);
  if (normalizedTicker) {
    const match = tx.select().from(stocks).where(eq(stocks.ticker, normalizedTicker)).get();
    if (match) return match;
  }
  return tx
    .select()
    .from(stocks)
    .where(eq(stocks.normalizedName, normalizeName(name)))
    .get();
}

function mapStockRow(row: typeof stocks.$inferSelect) {
  return {
    id: row.id,
    ticker: row.ticker,
    name: row.name,
    market: row.market,
    createdAt: row.createdAt,
  };
}

function parseStringArray(value: string): string[] {
  const decoded: unknown = JSON.parse(value);
  if (!Array.isArray(decoded) || decoded.some((item) => typeof item !== "string")) {
    throw new Error("Stored review list field is invalid");
  }
  return decoded;
}
