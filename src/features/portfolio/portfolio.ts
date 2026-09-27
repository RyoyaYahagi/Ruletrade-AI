import type { Transaction } from "@/schemas/transaction";
import {
  CORPORATE_ACTIONS,
  SONY_FINANCIAL_STOCK,
  type CorporateAction,
} from "@/features/portfolio/corporate-actions";

export type PortfolioStock = {
  id: string;
  name: string;
  ticker: string | null;
  marketCode: string | null;
  market?: string | null;
};

export type PortfolioHolding = {
  stockId: string;
  stockName: string;
  ticker: string | null;
  marketCode: string | null;
  quantity: number;
  averagePurchasePrice: number | null;
  acquisitionAmount: number | null;
  currency: "JPY" | "USD" | null;
  hasWarning: boolean;
  warningReason: string | null;
  adjustments: string[];
};

const OVERSELL_WARNING = "売買履歴上、保有数量を超える売却があります";
const MIXED_CURRENCY_WARNING = "異なる通貨の取引が混在しています";

function quantityEpsilon(...quantities: number[]): number {
  return Number.EPSILON * Math.max(1, ...quantities.map(Math.abs)) * 8;
}

type Position = {
  quantity: number;
  averagePurchasePrice: number | null;
  currency: "JPY" | "USD" | null;
  priceKnown: boolean;
  hasOversell: boolean;
  hasWarning: boolean;
  warningReason: string | null;
  adjustments: string[];
};

function compareDate(a: string, b: string): number {
  return Date.parse(a) - Date.parse(b);
}

function applyBuy(
  position: Position,
  quantity: number,
  price: number | null,
  currency: "JPY" | "USD" | null,
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

export function calculatePortfolio(
  transactions: readonly Transaction[],
  stocks: readonly PortfolioStock[],
): PortfolioHolding[] {
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

  type PortfolioEvent =
    | { type: "transaction"; transaction: Transaction }
    | { type: "action"; action: CorporateAction; stockId: string };
  const events: Array<{
    sortAt: string;
    sortPriority: number;
    event: PortfolioEvent;
  }> = transactions.map((transaction) => ({
    sortAt: transaction.executedAt,
    sortPriority: 1,
    event: { type: "transaction", transaction },
  }));
  for (const action of CORPORATE_ACTIONS) {
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
      if (
        amount - position.quantity >
        quantityEpsilon(amount, position.quantity)
      ) {
        position.hasWarning = true;
        position.hasOversell = true;
        position.warningReason = OVERSELL_WARNING;
        position.priceKnown = false;
        position.averagePurchasePrice = null;
        position.currency = null;
      }
      position.quantity -= amount;
      if (
        Math.abs(position.quantity) <=
        quantityEpsilon(position.quantity, amount)
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
    } else {
      const transactionCurrency = transaction.priceCurrency ?? null;
      applyBuy(position, amount, transaction.price, transactionCurrency);
    }
  }

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
