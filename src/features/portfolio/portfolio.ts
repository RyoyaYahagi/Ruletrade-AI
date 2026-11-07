import type { Bucket } from "@/schemas/stock";
import type { Transaction } from "@/schemas/transaction";
import {
  CORPORATE_ACTIONS,
  SONY_FINANCIAL_STOCK,
  type CorporateAction,
} from "@/features/portfolio/corporate-actions";
import { japanDate } from "@/features/transactions/matching";

export type PortfolioStock = {
  id: string;
  name: string;
  ticker: string | null;
  marketCode: string | null;
  market?: string | null;
  bucket?: Bucket;
};

export type PortfolioHolding = {
  stockId: string;
  stockName: string;
  ticker: string | null;
  marketCode: string | null;
  bucket: Bucket;
  quantity: number;
  averagePurchasePrice: number | null;
  acquisitionAmount: number | null;
  currency: "JPY" | "USD" | null;
  hasWarning: boolean;
  warningReason: string | null;
  adjustments: string[];
};

export type RealizedSale = {
  transactionId: string;
  stockId: string;
  stockName: string;
  ticker: string | null;
  side: "sell";
  quantity: number;
  executedAt: string;
  currency: "JPY" | "USD" | null;
  price: number | null;
  priceCurrency: "JPY" | "USD" | null;
  averagePurchasePrice: number | null;
  proceeds: number | null;
  costBasis: number | null;
  fee: number | null;
  feeCurrency: "JPY" | "USD" | null;
  realizedProfitLoss: number | null;
  warning: string | null;
  decisionId: string | null;
};

export type RealizedTotals = {
  currency: "JPY" | "USD" | null;
  saleCount: number;
  computedCount: number;
  proceeds: number | null;
  costBasis: number | null;
  realizedProfitLoss: number | null;
  completeness: boolean;
};

export type RealizedStockTotals = RealizedTotals & {
  stockId: string;
  stockName: string;
  ticker: string | null;
};

export type RealizedProfitLossResult = {
  sales: RealizedSale[];
  stockTotals: RealizedStockTotals[];
  totalsByCurrency: RealizedTotals[];
};

export type RealizedProfitLossPeriod = {
  from?: string | null;
  to?: string | null;
  stockId?: string | null;
};

const OVERSELL_WARNING = "売買履歴上、保有数量を超える売却があります";
const MIXED_CURRENCY_WARNING = "異なる通貨の取引が混在しています";
const UNKNOWN_HOLDING_CURRENCY_WARNING =
  "保有通貨が不明なため実現損益を計算できません";
const CURRENCY_MISMATCH_WARNING =
  "売却通貨が保有通貨と一致しないため実現損益を計算できません";
const UNKNOWN_SELL_PRICE_WARNING =
  "売却単価が不明なため実現損益を計算できません";
const UNKNOWN_AVERAGE_PRICE_WARNING =
  "平均取得単価が不明なため実現損益を計算できません";

type PortfolioCurrency = "JPY" | "USD";

function quantityEpsilon(...quantities: number[]): number {
  return Number.EPSILON * Math.max(1, ...quantities.map(Math.abs)) * 8;
}

type Position = {
  quantity: number;
  averagePurchasePrice: number | null;
  currency: PortfolioCurrency | null;
  priceKnown: boolean;
  hasOversell: boolean;
  hasWarning: boolean;
  warningReason: string | null;
  adjustments: string[];
};

type SellSnapshot = {
  transaction: Transaction;
  averagePurchasePrice: number | null;
  currency: PortfolioCurrency | null;
  oversell: boolean;
};

type PortfolioEvent =
  | { type: "transaction"; transaction: Transaction }
  | { type: "action"; action: CorporateAction; stockId: string };

type PortfolioEventEntry = {
  sortAt: string;
  sortPriority: number;
  event: PortfolioEvent;
};

function compareDate(a: string, b: string): number {
  return Date.parse(a) - Date.parse(b);
}

function applyBuy(
  position: Position,
  quantity: number,
  price: number | null,
  currency: PortfolioCurrency | null,
): void {
  const previousQuantity = position.quantity;
  position.quantity += quantity;
  if (
    previousQuantity <= quantityEpsilon(previousQuantity) &&
    !position.hasWarning
  ) {
    position.averagePurchasePrice = price;
    position.currency = currency;
    position.priceKnown = price !== null && currency !== null;
  } else if (
    currency !== null &&
    position.currency !== null &&
    currency !== position.currency
  ) {
    position.priceKnown = false;
    position.averagePurchasePrice = null;
    position.currency = null;
    if (!position.hasOversell) {
      position.hasWarning = true;
      position.warningReason = MIXED_CURRENCY_WARNING;
    }
  } else if (currency === null || position.currency === null) {
    position.priceKnown = false;
    position.averagePurchasePrice = null;
    position.currency = null;
  } else if (price === null) {
    position.priceKnown = false;
    position.averagePurchasePrice = null;
  } else if (position.priceKnown && position.averagePurchasePrice !== null) {
    position.averagePurchasePrice =
      (previousQuantity * position.averagePurchasePrice + quantity * price) /
      position.quantity;
  }
}

function applySell(position: Position, quantity: number): boolean {
  const oversell =
    quantity - position.quantity > quantityEpsilon(quantity, position.quantity);
  if (oversell) {
    position.hasWarning = true;
    position.hasOversell = true;
    position.warningReason = OVERSELL_WARNING;
    position.priceKnown = false;
    position.averagePurchasePrice = null;
    position.currency = null;
  }
  position.quantity -= quantity;
  if (
    Math.abs(position.quantity) <= quantityEpsilon(position.quantity, quantity)
  ) {
    position.quantity = 0;
    position.priceKnown = true;
    position.averagePurchasePrice = null;
    position.currency = null;
    if (position.warningReason === MIXED_CURRENCY_WARNING) {
      position.hasWarning = false;
      position.warningReason = null;
    }
  }
  return oversell;
}

function buildPortfolioEvents(
  transactions: readonly Transaction[],
  stocks: readonly PortfolioStock[],
): {
  events: PortfolioEventEntry[];
  stockById: Map<string, PortfolioStock>;
  childStockIds: Map<string, string>;
} {
  const eligibleStock = (stock: PortfolioStock) => {
    const market = stock.marketCode ?? stock.market ?? null;
    return market === null || market === "JP";
  };
  const stocksByTicker = new Map<string, PortfolioStock[]>();
  for (const stock of stocks) {
    if (stock.ticker === null || !eligibleStock(stock)) continue;
    const matches = stocksByTicker.get(stock.ticker) ?? [];
    matches.push(stock);
    stocksByTicker.set(stock.ticker, matches);
  }

  const stockById = new Map(stocks.map((stock) => [stock.id, stock]));
  const childStockIds = new Map<string, string>();
  for (const action of CORPORATE_ACTIONS) {
    if (action.type !== "spin-off") continue;
    const childMatches = (
      stocksByTicker.get(action.childTicker) ?? []
    ).toSorted((a, b) => a.id.localeCompare(b.id));
    if (childMatches.length > 1) {
      throw new Error(
        `Ambiguous portfolio stock ticker: ${action.childTicker}`,
      );
    }
    const childStock = childMatches[0] ?? SONY_FINANCIAL_STOCK;
    stockById.set(childStock.id, childStock);
    childStockIds.set(action.childTicker, childStock.id);
  }

  const events: PortfolioEventEntry[] = transactions.map((transaction) => ({
    sortAt: transaction.executedAt,
    sortPriority: 1,
    event: { type: "transaction", transaction },
  }));
  const todayInJapan = new Date(Date.now() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  for (const action of CORPORATE_ACTIONS) {
    if (action.exDate > todayInJapan) continue;
    const targetStocks = stocksByTicker.get(action.ticker) ?? [];
    if (targetStocks.length > 1) {
      throw new Error(`Ambiguous portfolio stock ticker: ${action.ticker}`);
    }
    const targetStock = targetStocks[0];
    if (!targetStock) continue;
    events.push({
      sortAt: `${action.exDate}T00:00:00+09:00`,
      sortPriority: 0,
      event: { type: "action", action, stockId: targetStock.id },
    });
  }
  events.sort(
    (a, b) =>
      compareDate(a.sortAt, b.sortAt) ||
      a.sortPriority - b.sortPriority ||
      (a.event.type === "transaction" && b.event.type === "transaction"
        ? compareDate(
            a.event.transaction.createdAt,
            b.event.transaction.createdAt,
          ) || a.event.transaction.id.localeCompare(b.event.transaction.id)
        : a.event.type === "action" && b.event.type === "action"
          ? a.event.action.type.localeCompare(b.event.action.type)
          : 0),
  );

  return { events, stockById, childStockIds };
}

function replayPortfolio(
  transactions: readonly Transaction[],
  stocks: readonly PortfolioStock[],
  onSell?: (sell: SellSnapshot) => void,
): {
  positions: Map<string, Position>;
  stockById: Map<string, PortfolioStock>;
} {
  const { events, stockById, childStockIds } = buildPortfolioEvents(
    transactions,
    stocks,
  );
  const positions = new Map<string, Position>();

  const positionFor = (stockId: string): Position => {
    const found = positions.get(stockId);
    if (found) return found;
    const position: Position = {
      quantity: 0,
      averagePurchasePrice: null,
      currency: null,
      priceKnown: true,
      hasOversell: false,
      hasWarning: false,
      warningReason: null,
      adjustments: [],
    };
    positions.set(stockId, position);
    return position;
  };

  for (const { event } of events) {
    if (event.type === "action") {
      const { action, stockId } = event;
      const parent = positions.get(stockId);
      if (!parent) continue;
      if (action.type === "split") {
        parent.quantity *= action.ratio;
        if (parent.quantity === 0) {
          parent.priceKnown = true;
          parent.averagePurchasePrice = null;
          parent.currency = null;
          if (parent.warningReason === MIXED_CURRENCY_WARNING) {
            parent.hasWarning = false;
            parent.warningReason = null;
          }
        }
        if (parent.priceKnown && parent.averagePurchasePrice !== null) {
          parent.averagePurchasePrice /= action.ratio;
        }
        if (parent.hasOversell) {
          parent.priceKnown = false;
          parent.averagePurchasePrice = null;
          parent.currency = null;
        }
        parent.adjustments.push(action.adjustmentLabel);
        continue;
      }

      if (
        parent.quantity <= quantityEpsilon(parent.quantity) ||
        parent.hasOversell
      ) {
        continue;
      }

      const childQuantity = parent.quantity * action.childRatio;
      if (childQuantity === 0) continue;
      const childStockId = childStockIds.get(action.childTicker);
      if (!childStockId)
        throw new Error(`Child stock not found: ${action.childTicker}`);
      const child = positionFor(childStockId);
      const childPrice =
        parent.priceKnown && parent.averagePurchasePrice !== null
          ? (parent.averagePurchasePrice * action.childBasisRatio) /
            action.childRatio
          : null;
      parent.averagePurchasePrice =
        parent.priceKnown && parent.averagePurchasePrice !== null
          ? parent.averagePurchasePrice * action.parentBasisRatio
          : null;
      parent.adjustments.push(action.adjustmentLabel);

      applyBuy(child, childQuantity, childPrice, parent.currency);
      child.adjustments.push(action.childAdjustmentLabel);
      continue;
    }

    const transaction = event.transaction;
    const position = positionFor(transaction.stockId);
    const amount = transaction.quantity;

    if (transaction.side === "sell") {
      const averagePurchasePrice = position.priceKnown
        ? position.averagePurchasePrice
        : null;
      const currency = position.currency;
      const oversell = applySell(position, amount);
      onSell?.({ transaction, averagePurchasePrice, currency, oversell });
    } else {
      const transactionCurrency = transaction.priceCurrency ?? null;
      applyBuy(position, amount, transaction.price, transactionCurrency);
    }
  }

  return { positions, stockById };
}

export function calculatePortfolio(
  transactions: readonly Transaction[],
  stocks: readonly PortfolioStock[],
): PortfolioHolding[] {
  const { positions, stockById } = replayPortfolio(transactions, stocks);

  return [...positions.entries()]
    .filter(
      ([, position]) =>
        position.quantity > quantityEpsilon(position.quantity) ||
        position.hasWarning,
    )
    .map(([stockId, position]) => {
      const stock = stockById.get(stockId);
      if (!stock) throw new Error(`Portfolio stock not found: ${stockId}`);
      const averagePurchasePrice =
        position.priceKnown && !position.hasWarning
          ? position.averagePurchasePrice
          : null;
      return {
        stockId,
        stockName: stock.name,
        ticker: stock.ticker,
        marketCode: stock.marketCode,
        bucket: stock.bucket ?? "unclassified",
        quantity:
          Math.abs(position.quantity) <= quantityEpsilon(position.quantity)
            ? 0
            : position.quantity,
        averagePurchasePrice,
        acquisitionAmount:
          averagePurchasePrice === null
            ? null
            : position.quantity * averagePurchasePrice,
        currency: position.currency,
        hasWarning: position.hasWarning,
        warningReason: position.warningReason,
        adjustments: position.adjustments,
      };
    });
}

export function calculateRealizedProfitLoss(
  transactions: readonly Transaction[],
  stocks: readonly PortfolioStock[],
  period: RealizedProfitLossPeriod = {},
): RealizedProfitLossResult {
  const sells: SellSnapshot[] = [];
  const { stockById } = replayPortfolio(transactions, stocks, (sell) => {
    sells.push(sell);
  });

  const sales = sells
    .map((sell) => {
      const stock = stockById.get(sell.transaction.stockId);
      if (!stock) {
        throw new Error(
          `Portfolio stock not found: ${sell.transaction.stockId}`,
        );
      }
      return realizedSale(sell, stock);
    })
    .filter(
      (sale) =>
        withinPeriod(sale.executedAt, period) &&
        (period.stockId == null || sale.stockId === period.stockId),
    )
    .sort(
      (a, b) =>
        a.executedAt.localeCompare(b.executedAt) ||
        a.transactionId.localeCompare(b.transactionId),
    );

  return {
    sales,
    stockTotals: summarizeByStock(sales),
    totalsByCurrency: summarizeByCurrency(sales),
  };
}

function realizedSale(sell: SellSnapshot, stock: PortfolioStock): RealizedSale {
  const { transaction, averagePurchasePrice, currency } = sell;
  const warning = realizedWarning(sell);
  const proceeds =
    transaction.price === null
      ? null
      : transaction.quantity * transaction.price;
  const costBasis =
    averagePurchasePrice === null
      ? null
      : transaction.quantity * averagePurchasePrice;
  return {
    transactionId: transaction.id,
    stockId: transaction.stockId,
    stockName: stock.name,
    ticker: stock.ticker,
    side: "sell",
    quantity: transaction.quantity,
    executedAt: transaction.executedAt,
    currency,
    price: transaction.price,
    priceCurrency: transaction.priceCurrency ?? null,
    averagePurchasePrice,
    proceeds,
    costBasis,
    fee: transaction.fee,
    feeCurrency: transaction.feeCurrency ?? null,
    realizedProfitLoss:
      warning === null && proceeds !== null && costBasis !== null
        ? proceeds - costBasis
        : null,
    warning,
    decisionId: transaction.decisionId,
  };
}

function realizedWarning(sell: SellSnapshot): string | null {
  const { transaction, averagePurchasePrice, currency, oversell } = sell;
  const sellCurrency = transaction.priceCurrency ?? currency;
  if (oversell) return OVERSELL_WARNING;
  if (currency === null) return UNKNOWN_HOLDING_CURRENCY_WARNING;
  if (sellCurrency !== currency) return CURRENCY_MISMATCH_WARNING;
  if (transaction.price === null) return UNKNOWN_SELL_PRICE_WARNING;
  if (averagePurchasePrice === null) return UNKNOWN_AVERAGE_PRICE_WARNING;
  return null;
}

function withinPeriod(
  executedAt: string,
  period: RealizedProfitLossPeriod,
): boolean {
  const executedOn = japanDate(executedAt);
  return (
    (period.from == null || executedOn >= period.from) &&
    (period.to == null || executedOn <= period.to)
  );
}

function summarizeRealizedProfitLoss(
  sales: readonly RealizedSale[],
): Omit<RealizedTotals, "currency"> {
  let proceeds = 0;
  let costBasis = 0;
  let realizedProfitLoss = 0;
  let computedCount = 0;
  for (const sale of sales) {
    if (sale.realizedProfitLoss === null) continue;
    proceeds += sale.proceeds!;
    costBasis += sale.costBasis!;
    realizedProfitLoss += sale.realizedProfitLoss;
    computedCount += 1;
  }
  const completeness = computedCount === sales.length;
  return {
    saleCount: sales.length,
    computedCount,
    proceeds: completeness ? proceeds : null,
    costBasis: completeness ? costBasis : null,
    realizedProfitLoss: completeness ? realizedProfitLoss : null,
    completeness,
  };
}

function summarizeByStock(
  sales: readonly RealizedSale[],
): RealizedStockTotals[] {
  const groups = new Map<string, RealizedSale[]>();
  for (const sale of sales) {
    const key = `${sale.stockId}\u0000${sale.currency ?? ""}`;
    const group = groups.get(key) ?? [];
    group.push(sale);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((group) => ({
      stockId: group[0].stockId,
      stockName: group[0].stockName,
      ticker: group[0].ticker,
      currency: group[0].currency,
      ...summarizeRealizedProfitLoss(group),
    }))
    .sort(
      (a, b) =>
        a.stockName.localeCompare(b.stockName, "ja") ||
        a.stockId.localeCompare(b.stockId) ||
        currencyOrder(a.currency) - currencyOrder(b.currency),
    );
}

function summarizeByCurrency(sales: readonly RealizedSale[]): RealizedTotals[] {
  const groups = new Map<PortfolioCurrency | null, RealizedSale[]>();
  for (const sale of sales) {
    const group = groups.get(sale.currency) ?? [];
    group.push(sale);
    groups.set(sale.currency, group);
  }
  return [...groups.entries()]
    .map(([currency, group]) => ({
      currency,
      ...summarizeRealizedProfitLoss(group),
    }))
    .sort((a, b) => currencyOrder(a.currency) - currencyOrder(b.currency));
}

function currencyOrder(currency: PortfolioCurrency | null): number {
  return currency === "JPY" ? 0 : currency === "USD" ? 1 : 2;
}

/**
 * Realized profit/loss for one holding in its own currency. A currency with no
 * sales has a known total of zero; any uncomputable sale makes it unknown.
 */
export function realizedProfitLossForStock(
  result: RealizedProfitLossResult,
  stockId: string,
  currency: PortfolioCurrency | null,
): number | null {
  const groups = result.stockTotals.filter(
    (total) => total.stockId === stockId && total.currency === currency,
  );
  if (groups.length === 0) return 0;
  return groups.every((group) => group.completeness)
    ? groups.reduce((sum, group) => sum + group.realizedProfitLoss!, 0)
    : null;
}

/**
 * Currency-wide realized profit/loss. A currency with no sales has a known
 * total of zero; a currency with an uncomputable sale is unknown.
 */
export function realizedProfitLossForCurrency(
  result: RealizedProfitLossResult,
  currency: PortfolioCurrency,
): number | null {
  const group = result.totalsByCurrency.find(
    (total) => total.currency === currency,
  );
  return group === undefined ? 0 : group.realizedProfitLoss;
}
