import { asc } from "drizzle-orm";

import { mapDecisionRow } from "@/features/decisions/decision-mapper";
import { getDb } from "@/lib/db";
import {
  captures,
  decisions,
  importBatches,
  importBatchStocks,
  reviews,
  stockBucketChanges,
  stocks,
  transactions,
  transactionImportSources,
  importChanges,
} from "@/lib/db/schema";
import { CaptureSchema } from "@/schemas/capture";
import { DecisionSchema } from "@/schemas/decision";
import { ReviewSchema } from "@/schemas/review";
import { StockSchema } from "@/schemas/stock";
import { TransactionSchema } from "@/schemas/transaction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const exportedAt = new Date().toISOString();
    // Read all tables in one snapshot so references stay consistent during writes.
    const data = getDb().transaction((tx) => ({
      stocks: tx
        .select()
        .from(stocks)
        .orderBy(asc(stocks.createdAt), asc(stocks.id))
        .all()
        .map((row) => ({
          ...StockSchema.parse(row),
          normalizedName: row.normalizedName,
          marketCode: row.marketCode,
        })),
      stockBucketChanges: tx
        .select()
        .from(stockBucketChanges)
        .orderBy(asc(stockBucketChanges.changedAt), asc(stockBucketChanges.id))
        .all(),
      decisions: tx
        .select()
        .from(decisions)
        .orderBy(asc(decisions.createdAt), asc(decisions.id))
        .all()
        .map((row) => DecisionSchema.parse(mapDecisionRow(row))),
      transactions: tx
        .select()
        .from(transactions)
        .orderBy(asc(transactions.createdAt), asc(transactions.id))
        .all()
        .map((row) => TransactionSchema.parse(row)),
      importBatches: tx
        .select()
        .from(importBatches)
        .orderBy(asc(importBatches.importedAt), asc(importBatches.id))
        .all(),
      importBatchStocks: tx
        .select()
        .from(importBatchStocks)
        .orderBy(asc(importBatchStocks.batchId), asc(importBatchStocks.stockId))
        .all(),
      transactionImportSources: tx
        .select()
        .from(transactionImportSources)
        .orderBy(asc(transactionImportSources.id))
        .all(),
      importChanges: tx
        .select()
        .from(importChanges)
        .orderBy(asc(importChanges.id))
        .all(),
      reviews: tx
        .select()
        .from(reviews)
        .orderBy(asc(reviews.createdAt), asc(reviews.id))
        .all()
        .map((row) => {
          const review = {
            ...row,
            differences: JSON.parse(row.differences) as unknown,
          };
          ReviewSchema.parse(review);
          return review;
        }),
      captures: tx
        .select()
        .from(captures)
        .orderBy(asc(captures.createdAt), asc(captures.id))
        .all()
        .map((row) => CaptureSchema.parse(row)),
    }));

    return new Response(
      JSON.stringify({ formatVersion: 4, exportedAt, ...data }, null, 2),
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="ruletrade-${exportedAt.replace(/[:.]/g, "-")}.json"`,
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return Response.json(
      {
        error:
          "記録をエクスポートできませんでした。時間をおいて再度お試しください。",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
