import type { DecisionType } from "@/schemas/decision";
import type { Transaction } from "@/schemas/transaction";

/** Date-only values stay unchanged; timestamps are compared in Japan's timezone. */
export function japanDate(value: string | Date = new Date()): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
    return value;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: string) =>
    parts.find((item) => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function initialDecisionType(
  transaction: Pick<Transaction, "side">,
): "buy" | "sell" {
  return transaction.side;
}

export function findTransactionCandidates<
  T extends Pick<
    Transaction,
    "id" | "stockId" | "side" | "executedAt" | "decisionId"
  >,
>(
  transactions: T[],
  type: DecisionType,
  decidedAt: string,
  stockId: string,
): T[] {
  const side =
    type === "buy" || type === "add" ? "buy" : type === "sell" ? "sell" : null;
  if (!side || !decidedAt) return [];
  return transactions.filter(
    (trade) =>
      trade.stockId === stockId &&
      trade.side === side &&
      trade.decisionId === null &&
      japanDate(trade.executedAt) === decidedAt,
  );
}
