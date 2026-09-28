import { NextResponse } from "next/server";
import { z } from "zod";

import { extractDecision } from "@/lib/ai/gemini";
import { DecisionExtractionSchema } from "@/schemas/decision";
import { getDb } from "@/lib/db";
import { decisions, stocks, transactions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { StockSchema } from "@/schemas/stock";
import { TransactionSchema } from "@/schemas/transaction";
import { mapDecisionRow } from "@/features/decisions/decision-mapper";
import { decisionDisplayText } from "@/features/decisions/decision-display";
import { calculatePortfolio } from "@/features/portfolio/portfolio";

const RequestSchema = z.object({
  stockId: z.string().min(1).optional(),
  transactionId: z.string().min(1).optional(),
  rawInput: z.string().trim().min(1).max(20000),
  followUpAnswer: z.string().trim().min(1).max(5000).optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "入力内容を確認してください。" },
      { status: 400 },
    );
  }
  try {
    const db = getDb();
    const stock = parsed.data.stockId ? db.select().from(stocks).where(eq(stocks.id, parsed.data.stockId)).get() : undefined;
    if (parsed.data.stockId && !stock) return NextResponse.json({ error: "銘柄が見つかりません。" }, { status: 404 });
    const stockTransactions = stock ? db.select().from(transactions).where(eq(transactions.stockId, stock.id)).all().map((row) => TransactionSchema.parse(row)) : [];
    const stockDecisions = stock ? db.select().from(decisions).where(eq(decisions.stockId, stock.id)).orderBy(desc(decisions.createdAt)).limit(5).all().map(mapDecisionRow) : [];
    const linked = parsed.data.transactionId ? stockTransactions.find((row) => row.id === parsed.data.transactionId) : undefined;
    if (parsed.data.transactionId && (!stock || !linked)) return NextResponse.json({ error: "売買記録が見つかりません。" }, { status: 404 });
    const stockRows = db.select().from(stocks).all().map((row) => ({ id: row.id, ticker: row.ticker, name: row.name, marketCode: row.marketCode, market: row.market }));
    const allTransactions = db.select().from(transactions).all().map((row) => TransactionSchema.parse(row));
    const holdings = calculatePortfolio(allTransactions, stockRows);
    const extraction = DecisionExtractionSchema.parse(await extractDecision({
      rawInput: parsed.data.rawInput,
      followUpAnswer: parsed.data.followUpAnswer,
      stock: stock ? StockSchema.parse({ id: stock.id, ticker: stock.ticker, name: stock.name, market: stock.market, createdAt: stock.createdAt }) : undefined,
      context: {
        linkedTransaction: linked ?? null,
        recentTransactions: stockTransactions.toSorted((a,b) => b.executedAt.localeCompare(a.executedAt)).slice(0, 5),
        recentDecisions: stockDecisions.map((decision) => ({
          id: decision.id,
          type: decision.type,
          decidedAt: decision.decidedAt,
          createdAt: decision.createdAt,
          rawInput: decision.rawInput,
          summary: decisionDisplayText(decision),
          points: decision.points ?? [],
        })),
        currentPosition: holdings.find((item) => item.stockId === stock?.id) ?? null,
        otherPositions: holdings.filter((item) => item.stockId !== stock?.id && item.quantity > 0),
      },
    }));
    return NextResponse.json({
      ...extraction,
      factContext: {
        currentPosition: holdings.find((item) => item.stockId === stock?.id) ?? null,
        linkedTransaction: linked ? {
          side: linked.side,
          quantity: linked.quantity,
          price: linked.price,
          priceCurrency: linked.priceCurrency,
          executedAt: linked.executedAt,
        } : null,
      },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "判断内容を整理できませんでした。入力を確認して再試行してください。",
      },
      { status: 502 },
    );
  }
}
