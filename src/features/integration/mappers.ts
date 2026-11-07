import type { MarketQuote } from "@/features/market-data/provider";
import type {
  PortfolioHolding,
  PortfolioStock,
} from "@/features/portfolio/portfolio";
import type {
  ValuedHolding,
  ValuationSummary,
} from "@/features/portfolio/valuation";
import type { Decision, DecisionPoint, DecisionType } from "@/schemas/decision";
import type { Origin } from "@/schemas/origin";
import type { Review } from "@/schemas/review";
import type { Transaction } from "@/schemas/transaction";

export type Money = {
  amount: number | null;
  currency: "JPY" | "USD" | null;
};

export type IntegrationStock = {
  id: string;
  ticker: string | null;
  name: string;
  market: string | null;
  marketCode: string | null;
  createdAt: string;
};

export type IntegrationDecision = {
  id: string;
  stockId: string;
  type: DecisionType;
  rawInput: string;
  transcript: string | null;
  followUpQuestion: string | null;
  followUpAnswer: string | null;
  summary: string | null;
  points: DecisionPoint[];
  thesis: string | null;
  assumptions: string[];
  reviewConditions: string[];
  addConditions: string[];
  reviewAt: string | null;
  reviewDates: string[];
  decidedAt: string | null;
  createdAt: string;
  origin: Origin;
};

export type IntegrationTransaction = {
  id: string;
  stockId: string;
  side: "buy" | "sell";
  quantity: number;
  price: Money | null;
  fee: Money | null;
  executedAt: string;
  decisionId: string | null;
  createdAt: string;
  settlement: {
    date: string | null;
    amount: Money | null;
    exchangeRate: number | null;
  } | null;
  accountType: string | null;
  sourceBroker: "rakuten" | "sbi" | "nomura" | "monex" | null;
  sourceTradeType: string | null;
};

export type IntegrationReview = {
  id: string;
  stockId: string;
  decisionId: string | null;
  currentInput: string;
  summary: string;
  differences: string[];
  reflection: string;
  createdAt: string;
  origin: Origin;
};

export type IntegrationHolding = {
  stockId: string;
  stockName: string;
  ticker: string | null;
  marketCode: string | null;
  quantity: number;
  averagePurchasePrice: Money | null;
  acquisitionAmount: Money | null;
  currency: "JPY" | "USD" | null;
  hasWarning: boolean;
  warningReason: string | null;
  adjustments: string[];
};

export type IntegrationQuote = {
  price: Money;
  priceAt: string | null;
  marketState: string | null;
  delayedByMinutes: number | null;
  sourceName: string | null;
};

export type IntegrationValuedHolding = IntegrationHolding & {
  quote: IntegrationQuote | null;
  quoteError: string | null;
  marketValue: Money | null;
  unrealizedProfitLoss: Money | null;
  unrealizedProfitLossRate: number | null;
  realizedProfitLoss: Money | null;
};

export type IntegrationCurrencyTotals = {
  currency: "JPY" | "USD";
  marketValue: Money | null;
  acquisitionAmount: Money | null;
  unrealizedProfitLoss: Money | null;
  unrealizedProfitLossRate: number | null;
  realizedProfitLoss: Money | null;
  completeness: {
    marketValue: boolean;
    acquisitionAmount: boolean;
    profitLoss: boolean;
    allocation: boolean;
  };
};

export type IntegrationTimelineItem =
  | {
      kind: "decision";
      occurredOn: string;
      occurredAt: string;
      decision: IntegrationDecision;
    }
  | {
      kind: "transaction";
      occurredOn: string;
      occurredAt: string;
      transaction: IntegrationTransaction;
    }
  | {
      kind: "review";
      occurredOn: string;
      occurredAt: string;
      review: IntegrationReview;
    };

export function toMoney(
  amount: number | null | undefined,
  currency: "JPY" | "USD" | null | undefined,
): Money | null {
  return amount === null || amount === undefined
    ? null
    : { amount, currency: currency ?? null };
}

export function toStock(
  row: PortfolioStock & { createdAt: string },
): IntegrationStock {
  return {
    id: row.id,
    ticker: row.ticker,
    name: row.name,
    market: row.market ?? null,
    marketCode: row.marketCode,
    createdAt: row.createdAt,
  };
}

export function toDecision(decision: Decision): IntegrationDecision {
  return {
    id: decision.id,
    stockId: decision.stockId,
    type: decision.type,
    rawInput: decision.rawInput,
    transcript: decision.transcript,
    followUpQuestion: decision.followUpQuestion ?? null,
    followUpAnswer: decision.followUpAnswer ?? null,
    summary: decision.summary ?? null,
    points: decision.points ?? [],
    thesis: decision.thesis,
    assumptions: decision.assumptions,
    reviewConditions: decision.reviewConditions,
    addConditions: decision.addConditions,
    reviewAt: decision.reviewAt,
    reviewDates:
      decision.reviewDates ??
      (decision.reviewAt === null ? [] : [decision.reviewAt]),
    decidedAt: decision.decidedAt ?? null,
    createdAt: decision.createdAt,
    origin: decision.origin,
  };
}

export function toTransaction(
  transaction: Transaction,
): IntegrationTransaction {
  const settlementDate = transaction.settlementDate ?? null;
  const settlementAmount = transaction.settlementAmount ?? null;
  const settlementCurrency = transaction.settlementCurrency ?? null;
  const exchangeRate = transaction.exchangeRate ?? null;

  return {
    id: transaction.id,
    stockId: transaction.stockId,
    side: transaction.side,
    quantity: transaction.quantity,
    price: toMoney(transaction.price, transaction.priceCurrency),
    fee: toMoney(transaction.fee, transaction.feeCurrency),
    executedAt: transaction.executedAt,
    decisionId: transaction.decisionId,
    createdAt: transaction.createdAt,
    settlement:
      settlementDate === null &&
      settlementAmount === null &&
      settlementCurrency === null &&
      exchangeRate === null
        ? null
        : {
            date: settlementDate,
            amount:
              settlementAmount === null
                ? null
                : { amount: settlementAmount, currency: settlementCurrency },
            exchangeRate,
          },
    accountType: transaction.accountType ?? null,
    sourceBroker: transaction.sourceBroker ?? null,
    sourceTradeType: transaction.sourceTradeType ?? null,
  };
}

export function toReview(review: Review): IntegrationReview {
  return {
    id: review.id,
    stockId: review.stockId,
    decisionId: review.decisionId,
    currentInput: review.currentInput,
    summary: review.summary,
    differences: review.differences,
    reflection: review.reflection,
    createdAt: review.createdAt,
    origin: review.origin,
  };
}

export function toHolding(holding: PortfolioHolding): IntegrationHolding {
  return {
    stockId: holding.stockId,
    stockName: holding.stockName,
    ticker: holding.ticker,
    marketCode: holding.marketCode,
    quantity: holding.quantity,
    averagePurchasePrice: toMoney(
      holding.averagePurchasePrice,
      holding.currency,
    ),
    acquisitionAmount: toMoney(holding.acquisitionAmount, holding.currency),
    currency: holding.currency,
    hasWarning: holding.hasWarning,
    warningReason: holding.warningReason,
    adjustments: holding.adjustments,
  };
}

export function toValuedHolding(
  valued: ValuedHolding,
): IntegrationValuedHolding {
  return {
    ...toHolding(valued.holding),
    quote: toQuote(valued.quote),
    quoteError: valued.quoteError,
    marketValue: toMoney(
      valued.marketValue,
      valued.quote?.currency ?? valued.holding.currency,
    ),
    unrealizedProfitLoss: toMoney(
      valued.unrealizedProfitLoss,
      valued.holding.currency,
    ),
    unrealizedProfitLossRate: valued.unrealizedProfitLossRate,
    // Filled by R-06; the response shape is fixed now.
    realizedProfitLoss: null,
  };
}

export function toCurrencyTotals(
  summary: ValuationSummary,
): IntegrationCurrencyTotals {
  return {
    currency: summary.currency,
    marketValue: toMoney(summary.marketValue, summary.currency),
    acquisitionAmount: toMoney(summary.acquisitionAmount, summary.currency),
    unrealizedProfitLoss: toMoney(
      summary.unrealizedProfitLoss,
      summary.currency,
    ),
    unrealizedProfitLossRate: summary.unrealizedProfitLossRate,
    // Filled by R-06; the response shape is fixed now.
    realizedProfitLoss: null,
    completeness: summary.completeness,
  };
}

export function toQuote(quote: MarketQuote | null): IntegrationQuote | null {
  return quote === null
    ? null
    : {
        price: { amount: quote.price, currency: quote.currency },
        priceAt: quote.priceAt,
        marketState: quote.marketState,
        delayedByMinutes: quote.delayedByMinutes,
        sourceName: quote.sourceName,
      };
}
