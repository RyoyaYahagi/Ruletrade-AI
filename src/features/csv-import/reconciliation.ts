import { z } from "zod";
import { normalizeName } from "@/features/csv-import/common";
import type { NormalizedTransaction } from "@/features/csv-import/types";
import type { stocks, transactions } from "@/lib/db/schema";

type Stock = typeof stocks.$inferSelect;
type Transaction = typeof transactions.$inferSelect;
export type Value = string | number | null;
export const transactionFields = [
  "side",
  "quantity",
  "price",
  "fee",
  "priceCurrency",
  "feeCurrency",
  "settlementDate",
  "settlementCurrency",
  "settlementAmount",
  "exchangeRate",
  "accountType",
] as const;
export const stockFields = ["name", "ticker", "market", "marketCode"] as const;
const fields = [...transactionFields, ...stockFields, "executedDate"] as const;
export const ResolutionSchema = z.array(
  z
    .object({
      sourceRowNumber: z.number().int().positive(),
      action: z.enum(["merge", "new", "skip"]),
      transactionId: z.string().optional(),
      fields: z
        .record(
          z.string().refine((key) => fields.some((field) => field === key)),
          z.enum(["manual", "csv"]),
        )
        .optional(),
    })
    .strict(),
);
export type Resolution = z.infer<typeof ResolutionSchema>[number];
export type Candidate = {
  id: string;
  stockId: string;
  values: Record<string, Value>;
  conflicts: string[];
  updates: { field: string; before: Value; after: Value }[];
};

const present = (value: Value) =>
  value !== null && (typeof value !== "string" || value.trim() !== "");
export function executionDate(value: string, market: string | null): string {
  // Date-only input is persisted at noon UTC by both existing entry paths.
  if (/T12:00:00(?:\.000)?Z$/.test(value)) return value.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: market === "US" ? "America/New_York" : "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
export function csvValues(row: NormalizedTransaction): Record<string, Value> {
  return {
    ...Object.fromEntries(
      transactionFields.map((field) => [field, row[field]]),
    ),
    name: row.stockName.trim(),
    ticker: row.ticker?.trim().toUpperCase() || null,
    market: row.marketCode,
    marketCode: row.marketCode,
    executedDate: executionDate(row.executedAt, row.marketCode),
  };
}
function similarNames(a: string, b: string): boolean {
  const clean = (name: string) =>
    normalizeName(name).replace(/株式会社|有限会社|[\s・.]/g, "");
  const left = clean(a),
    right = clean(b);
  // Only a complete distinctive name with a corporate suffix qualifies.
  if (left === right) return left.length > 0;
  const suffix = /^(?:ホールディングス|holdings|holding|hd|グループ|group)$/;
  return (
    (left.length >= 4 &&
      right.startsWith(left) &&
      suffix.test(right.slice(left.length))) ||
    (right.length >= 4 &&
      left.startsWith(right) &&
      suffix.test(left.slice(right.length)))
  );
}
export function candidatesFor(
  row: NormalizedTransaction,
  manuals: Transaction[],
  allStocks: Stock[],
): Candidate[] {
  const csv = csvValues(row);
  return manuals.flatMap((manual) => {
    const stock = allStocks.find((stock) => stock.id === manual.stockId);
    if (!stock) return [];
    const date = executionDate(manual.executedAt, row.marketCode);
    const tickerEqual =
      present(csv.ticker) && stock.ticker?.toUpperCase() === csv.ticker;
    const sameName = normalizeName(stock.name) === normalizeName(row.stockName);
    const similar = similarNames(stock.name, row.stockName);
    const market = stock.marketCode || stock.market;
    // Cross-market stocks with identical tickers are distinct securities.
    if (market && market !== row.marketCode && !sameName) return [];
    const exactFacts =
      date === csv.executedDate &&
      manual.side === row.side &&
      manual.quantity === row.quantity;
    // Name similarity is supporting evidence only after all three facts match.
    const identity =
      tickerEqual || sameName || (present(csv.ticker) && similar && exactFacts);
    if (!identity) return [];
    const facts = [
      date === csv.executedDate,
      manual.side === row.side,
      manual.quantity === row.quantity,
    ];
    // Permit a single conflicting identity field to be reviewed; do not infer split fills.
    if (facts.filter(Boolean).length < 2) return [];
    const values: Record<string, Value> = {
      ...Object.fromEntries(
        transactionFields.map((field) => [field, manual[field]]),
      ),
      name: stock.name,
      ticker: stock.ticker,
      market: stock.market,
      marketCode: stock.marketCode,
      executedDate: date,
    };
    const conflicts: string[] = [];
    const updates: Candidate["updates"] = [];
    for (const field of fields) {
      const before = values[field],
        after = csv[field];
      if (field === "name") {
        if (before !== after) updates.push({ field, before, after });
      } else if (
        present(before) &&
        present(after) &&
        (field === "ticker"
          ? String(before).trim().toUpperCase() !==
            String(after).trim().toUpperCase()
          : before !== after)
      )
        conflicts.push(field);
      else if (!present(before) && present(after))
        updates.push({ field, before, after });
    }
    return [{ id: manual.id, stockId: stock.id, values, conflicts, updates }];
  });
}
