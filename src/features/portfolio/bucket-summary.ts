import type { ExchangeRate } from "@/features/market-data/exchange-rate";
import type { MarketQuote } from "@/features/market-data/provider";
import { toQuoteSymbol } from "@/features/market-data/symbols";
import type { PortfolioHolding } from "@/features/portfolio/portfolio";
import type { Transaction } from "@/schemas/transaction";
import type { Bucket } from "@/schemas/stock";

export type BucketStock = {
  id: string;
  name: string;
  bucket: Bucket;
};

export type CurrencyTotals = {
  JPY: number;
  USD: number;
};

export type BucketTotals = {
  bucket: Bucket;
  stockCount: number;
  heldStockCount: number;
  investedByCurrency: CurrencyTotals;
  investedJpy: number | null;
  marketValueByCurrency: CurrencyTotals;
  marketValueJpy: number | null;
  investedComplete: boolean;
  marketValueComplete: boolean;
};

export type BucketSummary = {
  buckets: Record<Bucket, BucketTotals>;
  totalInvestedJpy: number | null;
  totalMarketValueJpy: number | null;
  satelliteInvestedJpy: number | null;
  satelliteInvestedPct: number | null;
  satelliteMarketValueJpy: number | null;
  satelliteMarketValuePct: number | null;
  exchangeRate: ExchangeRate | null;
  rateRequired: boolean;
  rateUnavailable: boolean;
  includesUnclassified: boolean;
  coreRegistered: boolean;
  substitutedStockIds: string[];
  substitutedStockNames: string[];
  investedComplete: boolean;
  marketValueComplete: boolean;
};

export type BucketSummaryInput = {
  stocks: readonly BucketStock[];
  holdings: readonly PortfolioHolding[];
  transactions: readonly Transaction[];
  quotes: ReadonlyMap<string, MarketQuote>;
  exchangeRate: ExchangeRate | null;
};

const BUCKETS: readonly Bucket[] = ["core", "satellite", "unclassified"];

function emptyCurrencyTotals(): CurrencyTotals {
  return { JPY: 0, USD: 0 };
}

function isCurrency(value: string | null | undefined): value is "JPY" | "USD" {
  return value === "JPY" || value === "USD";
}

function convertToJpy(
  totals: CurrencyTotals,
  rate: ExchangeRate | null,
): number | null {
  if (totals.USD === 0) return totals.JPY;
  if (rate === null) return null;
  return totals.JPY + totals.USD * rate.rate;
}

/**
 * D1: cumulative buy amounts (gross). Sells never reduce the invested amount.
 * Keep this definition inside this module so it can be changed in one place.
 */
export function calculateInvestedTotals(
  stocks: readonly BucketStock[],
  transactions: readonly Transaction[],
): {
  byBucket: Record<Bucket, CurrencyTotals>;
  complete: boolean;
  stockBuckets: Map<string, Bucket>;
} {
  const stockBuckets = new Map(stocks.map((stock) => [stock.id, stock.bucket]));
  const byBucket: Record<Bucket, CurrencyTotals> = {
    core: emptyCurrencyTotals(),
    satellite: emptyCurrencyTotals(),
    unclassified: emptyCurrencyTotals(),
  };
  let complete = true;

  for (const transaction of transactions) {
    if (transaction.side !== "buy") continue;
    const bucket = stockBuckets.get(transaction.stockId);
    if (!bucket)
      throw new Error(`Bucket stock not found: ${transaction.stockId}`);
    const currency = transaction.priceCurrency;
    if (
      transaction.price === null ||
      !Number.isFinite(transaction.price) ||
      !isCurrency(currency)
    ) {
      complete = false;
      continue;
    }
    byBucket[bucket][currency] += transaction.quantity * transaction.price;
  }

  return { byBucket, complete, stockBuckets };
}

export function buildBucketSummary(input: BucketSummaryInput): BucketSummary {
  const { stocks, holdings, transactions, quotes, exchangeRate } = input;
  const { byBucket: investedByBucket, complete: investedComplete } =
    calculateInvestedTotals(stocks, transactions);

  const marketByBucket: Record<Bucket, CurrencyTotals> = {
    core: emptyCurrencyTotals(),
    satellite: emptyCurrencyTotals(),
    unclassified: emptyCurrencyTotals(),
  };
  const heldCountByBucket: Record<Bucket, number> = {
    core: 0,
    satellite: 0,
    unclassified: 0,
  };
  const substitutedStockIds: string[] = [];
  const substitutedStockNames: string[] = [];
  let marketValueComplete = true;

  const bucketByStock = new Map(
    stocks.map((stock) => [stock.id, stock.bucket]),
  );
  for (const holding of holdings) {
    if (holding.quantity <= 0) continue;
    const bucket = bucketByStock.get(holding.stockId) ?? holding.bucket;
    heldCountByBucket[bucket] += 1;

    if (holding.currency === null) {
      marketValueComplete = false;
      continue;
    }
    const symbol = toQuoteSymbol(holding);
    const quote = symbol === null ? null : (quotes.get(symbol) ?? null);
    if (quote !== null && quote.currency === holding.currency) {
      marketByBucket[bucket][holding.currency] +=
        holding.quantity * quote.price;
      continue;
    }
    if (holding.acquisitionAmount !== null) {
      marketByBucket[bucket][holding.currency] += holding.acquisitionAmount;
      substitutedStockIds.push(holding.stockId);
      substitutedStockNames.push(holding.stockName);
      continue;
    }
    marketValueComplete = false;
  }

  const stockCountByBucket: Record<Bucket, number> = {
    core: 0,
    satellite: 0,
    unclassified: 0,
  };
  for (const stock of stocks) stockCountByBucket[stock.bucket] += 1;

  const buckets = Object.fromEntries(
    BUCKETS.map((bucket) => {
      const investedByCurrency = investedByBucket[bucket];
      const marketValueByCurrency = marketByBucket[bucket];
      return [
        bucket,
        {
          bucket,
          stockCount: stockCountByBucket[bucket],
          heldStockCount: heldCountByBucket[bucket],
          investedByCurrency,
          investedJpy: convertToJpy(investedByCurrency, exchangeRate),
          marketValueByCurrency,
          marketValueJpy: convertToJpy(marketValueByCurrency, exchangeRate),
          investedComplete,
          marketValueComplete,
        } satisfies BucketTotals,
      ];
    }),
  ) as Record<Bucket, BucketTotals>;

  const totalInvestedJpy = investedComplete
    ? convertToJpy(
        BUCKETS.reduce<CurrencyTotals>(
          (total, bucket) => ({
            JPY: total.JPY + investedByBucket[bucket].JPY,
            USD: total.USD + investedByBucket[bucket].USD,
          }),
          emptyCurrencyTotals(),
        ),
        exchangeRate,
      )
    : null;
  const totalMarketValueJpy = marketValueComplete
    ? convertToJpy(
        BUCKETS.reduce<CurrencyTotals>(
          (total, bucket) => ({
            JPY: total.JPY + marketByBucket[bucket].JPY,
            USD: total.USD + marketByBucket[bucket].USD,
          }),
          emptyCurrencyTotals(),
        ),
        exchangeRate,
      )
    : null;

  const satelliteInvestedJpy =
    investedComplete &&
    buckets.satellite.investedJpy !== null &&
    buckets.unclassified.investedJpy !== null
      ? buckets.satellite.investedJpy + buckets.unclassified.investedJpy
      : null;
  const satelliteMarketValueJpy =
    marketValueComplete &&
    buckets.satellite.marketValueJpy !== null &&
    buckets.unclassified.marketValueJpy !== null
      ? buckets.satellite.marketValueJpy + buckets.unclassified.marketValueJpy
      : null;

  const rateRequired = BUCKETS.some(
    (bucket) =>
      investedByBucket[bucket].USD !== 0 || marketByBucket[bucket].USD !== 0,
  );

  return {
    buckets,
    totalInvestedJpy,
    totalMarketValueJpy,
    satelliteInvestedJpy,
    satelliteInvestedPct:
      totalInvestedJpy !== null &&
      satelliteInvestedJpy !== null &&
      totalInvestedJpy > 0
        ? (satelliteInvestedJpy / totalInvestedJpy) * 100
        : null,
    satelliteMarketValueJpy,
    satelliteMarketValuePct:
      totalMarketValueJpy !== null &&
      satelliteMarketValueJpy !== null &&
      totalMarketValueJpy > 0
        ? (satelliteMarketValueJpy / totalMarketValueJpy) * 100
        : null,
    exchangeRate,
    rateRequired,
    rateUnavailable: rateRequired && exchangeRate === null,
    includesUnclassified: stockCountByBucket.unclassified > 0,
    coreRegistered: stockCountByBucket.core > 0,
    substitutedStockIds,
    substitutedStockNames,
    investedComplete,
    marketValueComplete,
  };
}
