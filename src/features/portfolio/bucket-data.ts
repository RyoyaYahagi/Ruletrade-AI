import "server-only";

import { asc } from "drizzle-orm";

import { getUsdJpyRate } from "@/features/market-data/exchange-rate";
import { marketPriceProvider } from "@/features/market-data/quotes";
import { toQuoteSymbol } from "@/features/market-data/symbols";
import { listPortfolioAction } from "@/features/portfolio/actions";
import {
  buildBucketSummary,
  type BucketSummary,
} from "@/features/portfolio/bucket-summary";
import type { PortfolioHolding } from "@/features/portfolio/portfolio";
import { getDb } from "@/lib/db";
import { stocks, transactions } from "@/lib/db/schema";
import { TransactionSchema } from "@/schemas/transaction";

export async function loadBucketSummary(
  holdingsInput?: readonly PortfolioHolding[],
): Promise<BucketSummary> {
  const holdings = holdingsInput ?? (await listPortfolioAction());
  const db = getDb();
  const stockRows = db
    .select({ id: stocks.id, name: stocks.name, bucket: stocks.bucket })
    .from(stocks)
    .orderBy(asc(stocks.name))
    .all();
  const transactionRows = db
    .select()
    .from(transactions)
    .all()
    .map((row) => TransactionSchema.parse(row));
  const symbols = [
    ...new Set(
      holdings
        .filter((holding) => holding.quantity > 0)
        .map((holding) => toQuoteSymbol(holding))
        .filter((symbol): symbol is string => symbol !== null),
    ),
  ];

  const [quotes, exchangeRate] = await Promise.all([
    symbols.length === 0
      ? Promise.resolve(new Map())
      : marketPriceProvider.getQuotes(symbols).catch(() => new Map()),
    getUsdJpyRate(),
  ]);

  return buildBucketSummary({
    stocks: stockRows,
    holdings,
    transactions: transactionRows,
    quotes,
    exchangeRate,
  });
}
