"use server";

import { normalizeName } from "@/features/csv-import/common";
import { getDb } from "@/lib/db";
import { stocks, transactions } from "@/lib/db/schema";
import { TransactionSchema } from "@/schemas/transaction";
import { calculatePortfolio, type PortfolioHolding } from "./portfolio";
import { SONY_FINANCIAL_STOCK } from "./corporate-actions";

export async function listPortfolioAction(): Promise<PortfolioHolding[]> {
  const db = getDb();
  return db.transaction((tx) => {
    const stockRows = tx
      .select({
        id: stocks.id,
        name: stocks.name,
        ticker: stocks.ticker,
        marketCode: stocks.marketCode,
        market: stocks.market,
      })
      .from(stocks)
      .all();
    const holdings = calculatePortfolio(
      tx
        .select()
        .from(transactions)
        .all()
        .map((row) => TransactionSchema.parse(row)),
      stockRows,
    );
    const distributedHolding = holdings.find(
      (holding) => holding.stockId === SONY_FINANCIAL_STOCK.id,
    );
    if (
      distributedHolding &&
      !stockRows.some((stock) => stock.id === distributedHolding.stockId)
    ) {
      // Only stock identity is registered so distributed shares can use the existing journal.
      // Holdings and synthetic buy transactions are never persisted.
      tx.insert(stocks)
        .values({
          ...SONY_FINANCIAL_STOCK,
          market: "JP",
          normalizedName: normalizeName(SONY_FINANCIAL_STOCK.name),
          createdAt: new Date().toISOString(),
        })
        .onConflictDoNothing({ target: stocks.id })
        .run();
    }
    return holdings;
  });
}
