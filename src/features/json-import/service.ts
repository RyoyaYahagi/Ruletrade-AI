import "server-only";

import { getTableColumns, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { schema } from "@/lib/db/schema";
import { DecisionSchema } from "@/schemas/decision";
import { ReviewSchema } from "@/schemas/review";
import { StockSchema } from "@/schemas/stock";
import { TransactionSchema } from "@/schemas/transaction";

const id = z.string().min(1);
const count = z.number().int().nonnegative();
const timestamp = z.string().datetime();
const stockSchema = StockSchema.extend({
  normalizedName: z.string().min(1),
  marketCode: z.string().nullable(),
});
const batchSchema = z.object({
  id,
  broker: z.enum(["rakuten", "sbi", "nomura", "monex"]),
  format: z.string().min(1),
  fileName: z.string(),
  rawCsv: z.string(),
  rawEncoding: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  importedAt: timestamp,
  transactionCount: count,
  duplicateCount: count,
  mergedCount: count,
  excludedCount: count,
  unknownCount: count,
  undoneAt: timestamp.nullable(),
});
const backupSchema = z.object({
  formatVersion: z.literal(1),
  exportedAt: timestamp,
  stocks: z.array(stockSchema),
  decisions: z.array(DecisionSchema),
  transactions: z.array(TransactionSchema),
  reviews: z.array(ReviewSchema),
  importBatches: z.array(batchSchema),
  importBatchStocks: z.array(
    z.object({
      batchId: id,
      stockId: id,
      createdByBatch: z.union([z.literal(0), z.literal(1)]),
    }),
  ),
  transactionImportSources: z.array(
    z.object({
      id,
      transactionId: id,
      importBatchId: id,
      sourceRowNumber: z.number().int().positive(),
      sourceFingerprint: id,
      createdAt: timestamp,
    }),
  ),
  importChanges: z.array(
    z.object({
      id,
      importBatchId: id,
      entity: z.enum(["stock", "transaction"]),
      entityId: id,
      before: z.string(),
      after: z.string(),
    }),
  ),
});

export class JsonImportError extends Error {}

type Row = Record<string, string | number | null>;

export function importJson(value: unknown) {
  const parsed = backupSchema.safeParse(value);
  if (!parsed.success)
    throw new JsonImportError(
      "対応するJSON形式ではありません。このアプリでエクスポートしたJSONを選択してください。",
    );
  const data = parsed.data;
  const stockIds = new Set(data.stocks.map((row) => row.id));
  const decisionIds = new Map(
    data.decisions.map((row) => [row.id, row.stockId]),
  );
  const batchIds = new Set(data.importBatches.map((row) => row.id));
  const transactionIds = new Set(data.transactions.map((row) => row.id));
  const requireReference = (valid: boolean) => {
    if (!valid)
      throw new JsonImportError(
        "JSON内の記録の参照関係が不正です。取り込みは行いませんでした。",
      );
  };
  for (const row of data.decisions) {
    requireReference(stockIds.has(row.stockId));
    for (const edit of row.editHistory ?? [])
      requireReference(
        edit.previous.id === row.id && edit.previous.stockId === row.stockId,
      );
  }
  for (const row of [...data.transactions, ...data.reviews]) {
    requireReference(stockIds.has(row.stockId));
    if (row.decisionId != null)
      requireReference(decisionIds.get(row.decisionId) === row.stockId);
  }
  for (const row of data.transactions)
    if (row.importBatchId != null)
      requireReference(batchIds.has(row.importBatchId));
  for (const row of data.importBatchStocks)
    requireReference(batchIds.has(row.batchId) && stockIds.has(row.stockId));
  for (const row of data.transactionImportSources)
    requireReference(
      batchIds.has(row.importBatchId) && transactionIds.has(row.transactionId),
    );
  // Undo history contains partial database rows. Only CSV-editable fields may be restored.
  const stockPatch = stockSchema
    .pick({
      name: true,
      normalizedName: true,
      ticker: true,
      market: true,
      marketCode: true,
    })
    .partial()
    .strict();
  const transactionPatch = TransactionSchema.pick({
    side: true,
    quantity: true,
    price: true,
    fee: true,
    executedAt: true,
    priceCurrency: true,
    feeCurrency: true,
    settlementDate: true,
    settlementCurrency: true,
    settlementAmount: true,
    exchangeRate: true,
    accountType: true,
  })
    .partial()
    .strict();
  for (const row of data.importChanges) {
    requireReference(batchIds.has(row.importBatchId));
    requireReference(
      row.entity === "stock"
        ? stockIds.has(row.entityId)
        : transactionIds.has(row.entityId),
    );
    try {
      const validator = row.entity === "stock" ? stockPatch : transactionPatch;
      const before = validator.parse(JSON.parse(row.before));
      const after = validator.parse(JSON.parse(row.after));
      requireReference(
        JSON.stringify(Object.keys(before).sort()) ===
          JSON.stringify(Object.keys(after).sort()),
      );
    } catch {
      throw new JsonImportError(
        "JSON内のCSV取り込み履歴が不正です。取り込みは行いませんでした。",
      );
    }
  }
  const rows: Record<keyof typeof schema, Row[]> = {
    stocks: data.stocks,
    importBatches: data.importBatches,
    decisions: data.decisions.map((row) => ({
      ...row,
      assumptions: JSON.stringify(row.assumptions),
      reviewConditions: JSON.stringify(row.reviewConditions),
      addConditions: JSON.stringify(row.addConditions),
      reviewDates: JSON.stringify(
        row.reviewDates ?? (row.reviewAt ? [row.reviewAt] : []),
      ),
      editHistory: JSON.stringify(row.editHistory ?? []),
      decidedAt: row.decidedAt ?? null,
    })),
    transactions: data.transactions.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, value ?? null]),
      ),
    ),
    reviews: data.reviews.map((row) => ({
      ...row,
      differences: JSON.stringify(row.differences),
    })),
    importBatchStocks: data.importBatchStocks,
    transactionImportSources: data.transactionImportSources,
    importChanges: data.importChanges,
  };
  return getDb().transaction((tx) => {
    let importedCount = 0;
    let skippedCount = 0;
    // Table/column names come exclusively from the application's schema, never the file.
    for (const key of [
      "stocks",
      "importBatches",
      "decisions",
      "transactions",
      "reviews",
      "importBatchStocks",
      "transactionImportSources",
      "importChanges",
    ] as const) {
      const columns: Record<string, { name: string }> = getTableColumns(
        schema[key],
      );
      const fields = Object.keys(columns);
      const identity =
        key === "importBatchStocks" ? ["batchId", "stockId"] : ["id"];
      const seen = new Set<string>();
      for (const row of rows[key]) {
        const identityKey = JSON.stringify(identity.map((field) => row[field]));
        if (seen.has(identityKey))
          throw new JsonImportError(
            "JSON内に同じ識別子の記録が複数あります。取り込みは行いませんでした。",
          );
        seen.add(identityKey);
        const existing = tx.get(
          sql`SELECT ${sql.join(
            fields.map(
              (field) =>
                sql`${sql.identifier(columns[field].name)} AS ${sql.identifier(field)}`,
            ),
            sql`, `,
          )} FROM ${schema[key]} WHERE ${sql.join(
            identity.map(
              (field) =>
                sql`${sql.identifier(columns[field].name)} = ${row[field]}`,
            ),
            sql` AND `,
          )}`,
        );
        const stored = z
          .record(z.string(), z.union([z.string(), z.number(), z.null()]))
          .optional()
          .parse(existing);
        if (stored) {
          // Older decision rows store absent lists as null; exports expose those lists.
          if (key === "decisions") {
            stored.editHistory ??= "[]";
            stored.reviewDates ??= JSON.stringify(
              stored.reviewAt ? [stored.reviewAt] : [],
            );
          }
          if (fields.some((field) => stored[field] !== (row[field] ?? null)))
            throw new JsonImportError(
              "既存の記録と同じ識別子で内容が異なります。既存データを上書きせず、取り込みを中止しました。",
            );
          skippedCount += 1;
        } else {
          tx.run(
            sql`INSERT INTO ${schema[key]} (${sql.join(
              fields.map((field) => sql.identifier(columns[field].name)),
              sql`, `,
            )}) VALUES (${sql.join(
              fields.map((field) => sql`${row[field] ?? null}`),
              sql`, `,
            )})`,
          );
          importedCount += 1;
        }
      }
    }
    return { importedCount, skippedCount };
  });
}
