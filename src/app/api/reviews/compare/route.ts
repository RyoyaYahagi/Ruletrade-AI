import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { compareDecision } from "@/lib/ai/gemini";
import { getDb } from "@/lib/db";
import { decisions, stocks } from "@/lib/db/schema";
import { mapDecisionRow } from "@/features/decisions/decision-mapper";
import { DecisionSchema } from "@/schemas/decision";
import { StockSchema } from "@/schemas/stock";

const RequestSchema = z.object({
  stockId: z.string().min(1),
  currentInput: z.string().trim().min(1).max(20000),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力内容を確認してください。" }, { status: 400 });
  }

  try {
    const db = getDb();
    const stockRow = db.select().from(stocks).where(eq(stocks.id, parsed.data.stockId)).get();
    if (!stockRow) return NextResponse.json({ error: "銘柄が見つかりません。" }, { status: 404 });
    const decisionRows = db
      .select()
      .from(decisions)
      .where(eq(decisions.stockId, parsed.data.stockId))
      .orderBy(asc(decisions.createdAt))
      .all();
    const history = decisionRows.map((row) => DecisionSchema.parse(mapDecisionRow(row)));
    const result = await compareDecision({ currentInput: parsed.data.currentInput, decisions: history });
    return NextResponse.json({ stock: StockSchema.parse({
      id: stockRow.id,
      ticker: stockRow.ticker,
      name: stockRow.name,
      market: stockRow.market,
      createdAt: stockRow.createdAt,
    }), ...result });
  } catch {
    return NextResponse.json({ error: "過去の判断と比較できませんでした。" }, { status: 502 });
  }
}
