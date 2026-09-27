import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, gt, isNull, or } from "drizzle-orm";

import { getDb, type AppDatabase } from "@/lib/db";
import {
  decisions,
  importBatchStocks,
  importBatches,
  reviews,
  stocks,
  transactions,
  transactionImportSources,
  importChanges,
} from "@/lib/db/schema";
import { normalizeName, parseCsv } from "@/features/csv-import/parser";
import type { NormalizedTransaction } from "@/features/csv-import/parser";

import {
  candidatesFor,
  csvValues,
  ResolutionSchema,
  transactionFields,
  stockFields,
  type Candidate,
  type Value,
} from "./reconciliation";
export type { Resolution } from "./reconciliation";

type ParsedCsv = Awaited<ReturnType<typeof parseCsv>>;
type Counts = {
  new: number;
  duplicate: number;
  merged: number;
  review: number;
  excluded: number;
  unknown: number;
};
type PreviewRow = {
  transaction: NormalizedTransaction;
  status: "new" | "duplicate" | "merged" | "review";
  candidates: Candidate[];
  warning?: string;
};

export type CsvPreview = ParsedCsv & {
  rows: PreviewRow[];
  counts: Counts;
  digest: string;
};

function fingerprintFor(transaction: NormalizedTransaction): string {
  const ticker = transaction.ticker?.trim().toUpperCase();
  const identity = ticker
    ? `ticker:${ticker}`
    : `name:${normalizeName(transaction.stockName)}`;
  const fields = [
    transaction.marketCode,
    identity,
    transaction.sourceBroker,
    transaction.accountType,
    transaction.side,
    transaction.quantity,
    transaction.price,
    transaction.priceCurrency,
    transaction.fee,
    transaction.feeCurrency,
    transaction.executedAt,
    transaction.settlementDate,
    transaction.settlementCurrency,
    transaction.settlementAmount,
    transaction.exchangeRate,
  ];
  return createHash("sha256").update(JSON.stringify(fields)).digest("hex");
}

function derivePreview(
  parsed: ParsedCsv,
  db: Pick<AppDatabase, "select"> = getDb(),
): CsvPreview {
  const counts: Counts = {
    new: 0,
    duplicate: 0,
    merged: 0,
    review: 0,
    excluded: parsed.excluded.length,
    unknown: parsed.unknown.length,
  };
  const priorCounts = new Map<string, number>();
  const existingCounts = new Map<string, number>();
  for (const { fingerprint } of db
    .select({ fingerprint: transactions.sourceFingerprint })
    .from(transactions)
    .all()) {
    if (fingerprint)
      existingCounts.set(
        fingerprint,
        (existingCounts.get(fingerprint) ?? 0) + 1,
      );
  }
  for (const source of db.select().from(transactionImportSources).all()) {
    existingCounts.set(
      source.sourceFingerprint,
      (existingCounts.get(source.sourceFingerprint) ?? 0) + 1,
    );
  }
  const allStocks = db.select().from(stocks).all();
  const sourcedIds = new Set(
    db
      .select()
      .from(transactionImportSources)
      .all()
      .map((source) => source.transactionId),
  );
  const manuals = db
    .select()
    .from(transactions)
    .all()
    .filter(
      (row) =>
        !row.importBatchId && !row.sourceFingerprint && !sourcedIds.has(row.id),
    );
  const rows: PreviewRow[] = parsed.transactions.map((transaction) => {
    const fingerprint = fingerprintFor(transaction);
    const alreadySaved = existingCounts.get(fingerprint) ?? 0;
    const earlierInFile = priorCounts.get(fingerprint) ?? 0;
    priorCounts.set(fingerprint, earlierInFile + 1);
    const status: PreviewRow["status"] =
      earlierInFile < alreadySaved ? "duplicate" : "new";
    const candidates =
      status === "duplicate"
        ? []
        : candidatesFor(transaction, manuals, allStocks);
    return {
      transaction,
      status:
        status === "duplicate"
          ? status
          : candidates.length === 0
            ? "new"
            : candidates.length === 1 && candidates[0].conflicts.length === 0
              ? "merged"
              : "review",
      candidates,
    };
  });
  const uses = new Map<string, number>();
  for (const row of rows)
    for (const candidate of row.candidates)
      uses.set(candidate.id, (uses.get(candidate.id) ?? 0) + 1);
  const stockTickers = new Map<string, Set<string>>();
  for (const row of rows)
    for (const candidate of row.candidates) {
      const tickers = stockTickers.get(candidate.stockId) ?? new Set<string>();
      if (row.transaction.ticker)
        tickers.add(row.transaction.ticker.trim().toUpperCase());
      stockTickers.set(candidate.stockId, tickers);
    }
  for (const row of rows) {
    if (row.status === "merged" && uses.get(row.candidates[0].id)! > 1)
      row.status = "review";
    if (
      row.candidates.some(
        (candidate) => stockTickers.get(candidate.stockId)!.size > 1,
      )
    ) {
      row.status = "review";
      row.warning =
        "同じ既存銘柄の候補に異なる銘柄コードのCSV行があります。すべてを同じ銘柄へ統合できません。";
    }
    counts[row.status] += 1;
  }
  const digest = createHash("sha256")
    .update(
      JSON.stringify({
        raw: parsed.rawCsv,
        allStocks,
        manuals,
        rows: rows.map(({ transaction, status, candidates }) => [
          fingerprintFor(transaction),
          status,
          candidates,
        ]),
      }),
    )
    .digest("hex");
  return { ...parsed, rows, counts, digest };
}

export async function previewCsv(bytes: Uint8Array): Promise<CsvPreview> {
  return derivePreview(await parseCsv(bytes));
}

function findStock(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  row: NormalizedTransaction,
  allowDistinctStock = false,
) {
  const market = row.marketCode;
  const ticker = row.ticker?.trim().toUpperCase() || null;
  if (ticker) {
    let matches = tx
      .select()
      .from(stocks)
      .where(and(eq(stocks.ticker, ticker), eq(stocks.marketCode, market)))
      .all();
    if (matches.length === 0)
      matches = tx
        .select()
        .from(stocks)
        .where(
          and(
            eq(stocks.ticker, ticker),
            isNull(stocks.marketCode),
            or(isNull(stocks.market), eq(stocks.market, market)),
          ),
        )
        .all();
    if (matches.length > 1)
      throw new Error(
        `銘柄コード ${ticker}（${market}）に一致する銘柄が複数あります。`,
      );
    if (matches[0]) {
      if (!matches[0].marketCode)
        tx.update(stocks)
          .set({ marketCode: market })
          .where(eq(stocks.id, matches[0].id))
          .run();
      tx.update(stocks)
        .set({
          name: row.stockName.trim(),
          normalizedName: normalizeName(row.stockName),
          marketCode: market,
          market: matches[0].market || market,
        })
        .where(eq(stocks.id, matches[0].id))
        .run();
      return { stock: { ...matches[0], marketCode: market }, created: false };
    }
  }

  const normalizedName = normalizeName(row.stockName);
  let matches = tx
    .select()
    .from(stocks)
    .where(
      and(
        eq(stocks.normalizedName, normalizedName),
        eq(stocks.marketCode, market),
      ),
    )
    .all();
  if (matches.length === 0)
    matches = tx
      .select()
      .from(stocks)
      .where(
        and(
          eq(stocks.normalizedName, normalizedName),
          isNull(stocks.marketCode),
          or(isNull(stocks.market), eq(stocks.market, market)),
        ),
      )
      .all();
  if (allowDistinctStock && ticker)
    matches = matches.filter(
      (stock) => !stock.ticker || stock.ticker === ticker,
    );
  if (matches.length > 1)
    throw new Error(
      `銘柄名「${row.stockName}」（${market}）に一致する銘柄が複数あります。`,
    );
  if (matches[0]) {
    if (ticker && matches[0].ticker && matches[0].ticker !== ticker) {
      throw new Error(
        `銘柄名「${row.stockName}」は既に別の銘柄コード ${matches[0].ticker} に紐付いています。`,
      );
    }
    const patch = {
      name: row.stockName.trim(),
      normalizedName,
      ticker: matches[0].ticker || ticker,
      marketCode: matches[0].marketCode || market,
      market: matches[0].market || market,
    };
    tx.update(stocks).set(patch).where(eq(stocks.id, matches[0].id)).run();
    return { stock: { ...matches[0], ...patch }, created: false };
  }
  if (!normalizedName)
    throw new Error("銘柄名がないため、取引を銘柄に紐付けられません。");
  const stock = {
    id: randomUUID(),
    ticker,
    name: row.stockName.trim(),
    normalizedName,
    market,
    marketCode: market,
    createdAt: new Date().toISOString(),
  };
  tx.insert(stocks).values(stock).run();
  return { stock, created: true };
}

export async function importCsv(
  bytes: Uint8Array,
  fileName: string,
  expectedPreviewDigest?: string,
  inputResolutions: unknown = [],
) {
  const resolutions = ResolutionSchema.parse(inputResolutions);
  const parsed = await parseCsv(bytes);
  const db = getDb();
  const batchId = randomUUID();
  const now = new Date().toISOString();
  const incoming = derivePreview(parsed, db);
  if (expectedPreviewDigest && incoming.digest !== expectedPreviewDigest) {
    throw new Error(
      "プレビュー後に取引データが変わりました。CSVを再度プレビューしてください。",
    );
  }
  const rawBytes = Buffer.from(bytes);
  const rawCsv = parsed.rawCsv;
  let importedCount = 0;
  let mergedCount = 0;

  db.transaction(
    (tx) => {
      const current = derivePreview(parsed, tx);
      if (expectedPreviewDigest && current.digest !== expectedPreviewDigest) {
        throw new Error(
          "プレビュー後に取引データが変わりました。CSVを再度プレビューしてください。",
        );
      }
      if (
        new Set(resolutions.map((row) => row.sourceRowNumber)).size !==
        resolutions.length
      )
        throw new Error("同じCSV行の選択が重複しています。");
      for (const resolution of resolutions) {
        if (
          !current.rows.some(
            (row) =>
              row.status === "review" &&
              row.transaction.sourceRowNumber === resolution.sourceRowNumber,
          )
        )
          throw new Error("要確認の取引だけ処理方法を選択してください。");
      }
      const batchTransactions = current.rows.filter(
        ({ status }) => status !== "duplicate",
      );
      const mergedIds = new Set<string>();
      const selectedStocks = new Map<string, Record<string, Value>>();
      for (const row of batchTransactions) {
        const resolution = resolutions.find(
          (item) => item.sourceRowNumber === row.transaction.sourceRowNumber,
        );
        if (row.status === "review" && !resolution)
          throw new Error("要確認の取引の処理方法を選択してください。");
        if (row.status === "merged" || resolution?.action === "merge") {
          const candidate =
            row.status === "merged"
              ? row.candidates[0]
              : row.candidates.find(
                  (item) => item.id === resolution?.transactionId,
                );
          if (!candidate) throw new Error("統合先の取引を選択してください。");
          if (mergedIds.has(candidate.id))
            throw new Error("複数CSV行を同じ取引へ統合できません。");
          mergedIds.add(candidate.id);
          for (const field of candidate.conflicts)
            if (!resolution?.fields?.[field])
              throw new Error("異なる項目の採用値を選択してください。");
          const csv = csvValues(row.transaction);
          const chosen = selectedStocks.get(candidate.stockId) ?? {};
          for (const field of ["ticker", "market", "marketCode"]) {
            const value =
              candidate.conflicts.includes(field) &&
              resolution?.fields?.[field] === "manual"
                ? candidate.values[field]
                : (csv[field] ?? candidate.values[field]);
            if (chosen[field] && value && chosen[field] !== value)
              throw new Error(
                "同じ銘柄に異なる銘柄コード・市場のCSV行を統合できません。別の取引として追加するか、今回はインポートしないを選択してください。",
              );
            if (value) chosen[field] = value;
          }
          selectedStocks.set(candidate.stockId, chosen);
        }
      }
      tx.insert(importBatches)
        .values({
          id: batchId,
          broker: parsed.broker,
          format: parsed.format,
          fileName,
          rawCsv,
          rawEncoding: parsed.rawEncoding,
          sha256: createHash("sha256").update(rawBytes).digest("hex"),
          importedAt: now,
          transactionCount: batchTransactions.filter(
            (row) =>
              row.status === "new" ||
              resolutions.find(
                (item) =>
                  item.sourceRowNumber === row.transaction.sourceRowNumber,
              )?.action === "new",
          ).length,
          duplicateCount: current.counts.duplicate,
          mergedCount: mergedIds.size,
          excludedCount: current.counts.excluded,
          unknownCount: current.counts.unknown,
          undoneAt: null,
        })
        .run();

      const trackedStocks = new Map<string, boolean>();
      const stockBefore = new Map<string, typeof stocks.$inferSelect>(
        tx
          .select()
          .from(stocks)
          .all()
          .map((stock) => [stock.id, stock]),
      );
      for (const row of batchTransactions) {
        const { transaction } = row;
        const resolution = resolutions.find(
          (item) => item.sourceRowNumber === transaction.sourceRowNumber,
        );
        if (resolution?.action === "skip") continue;
        if (row.status === "merged" || resolution?.action === "merge") {
          const candidate =
            row.status === "merged"
              ? row.candidates[0]
              : row.candidates.find(
                  (item) => item.id === resolution?.transactionId,
                )!;
          const manual = tx
            .select()
            .from(transactions)
            .where(eq(transactions.id, candidate.id))
            .get()!;
          const stock = tx
            .select()
            .from(stocks)
            .where(eq(stocks.id, candidate.stockId))
            .get()!;
          const csv = csvValues(transaction);
          const selected = (field: string) =>
            candidate.updates.some((update) => update.field === field) ||
            (candidate.conflicts.includes(field) &&
              resolution?.fields?.[field] === "csv");
          const transactionPatch: Partial<typeof transactions.$inferInsert> =
            {};
          for (const field of transactionFields)
            if (selected(field))
              Object.assign(transactionPatch, { [field]: csv[field] });
          if (selected("executedDate"))
            transactionPatch.executedAt = transaction.executedAt;
          const stockPatch: Partial<typeof stocks.$inferInsert> = {};
          for (const field of stockFields)
            if (selected(field))
              Object.assign(stockPatch, { [field]: csv[field] });
          if (stockPatch.name)
            stockPatch.normalizedName = normalizeName(stockPatch.name);
          if (Object.keys(transactionPatch).length) {
            tx.update(transactions)
              .set(transactionPatch)
              .where(eq(transactions.id, manual.id))
              .run();
            recordChange(tx, batchId, "transaction", manual.id, manual, {
              ...manual,
              ...transactionPatch,
            });
          }
          if (Object.keys(stockPatch).length)
            tx.update(stocks)
              .set(stockPatch)
              .where(eq(stocks.id, stock.id))
              .run();
          tx.insert(transactionImportSources)
            .values({
              id: randomUUID(),
              transactionId: manual.id,
              importBatchId: batchId,
              sourceRowNumber: transaction.sourceRowNumber,
              sourceFingerprint: fingerprintFor(transaction),
              createdAt: now,
            })
            .run();
          trackedStocks.set(stock.id, false);
          mergedCount += 1;
          continue;
        }
        const { stock, created } = findStock(
          tx,
          transaction,
          resolution?.action === "new",
        );
        trackedStocks.set(
          stock.id,
          (trackedStocks.get(stock.id) ?? false) || created,
        );
        tx.insert(transactions)
          .values({
            id: randomUUID(),
            stockId: stock.id,
            side: transaction.side,
            quantity: transaction.quantity,
            price: transaction.price,
            fee: transaction.fee,
            executedAt: transaction.executedAt,
            decisionId: null,
            createdAt: now,
            priceCurrency: transaction.priceCurrency,
            feeCurrency: transaction.feeCurrency,
            settlementDate: transaction.settlementDate,
            settlementCurrency: transaction.settlementCurrency,
            settlementAmount: transaction.settlementAmount,
            exchangeRate: transaction.exchangeRate,
            accountType: transaction.accountType,
            sourceBroker: transaction.sourceBroker,
            sourceTradeType: transaction.sourceTradeType,
            importBatchId: batchId,
            sourceFingerprint: fingerprintFor(transaction),
            sourceRowNumber: transaction.sourceRowNumber,
          })
          .run();
        importedCount += 1;
      }
      for (const [stockId, createdByBatch] of trackedStocks) {
        const before = stockBefore.get(stockId);
        const after = tx
          .select()
          .from(stocks)
          .where(eq(stocks.id, stockId))
          .get()!;
        if (before) recordChange(tx, batchId, "stock", stockId, before, after);
        tx.insert(importBatchStocks)
          .values({ batchId, stockId, createdByBatch: createdByBatch ? 1 : 0 })
          .run();
      }
    },
    { behavior: "immediate" },
  );

  return { batchId, importedCount, mergedCount };
}

type DbTransaction = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];
function recordChange(
  tx: DbTransaction,
  batchId: string,
  entity: string,
  entityId: string,
  before: object,
  after: object,
) {
  const previous: Record<string, Value> = {},
    next: Record<string, Value> = {};
  for (const [key, value] of Object.entries(after)) {
    const old = Object.getOwnPropertyDescriptor(before, key)?.value;
    if (old !== value) {
      previous[key] = old;
      next[key] = value;
    }
  }
  if (!Object.keys(next).length) return;
  tx.insert(importChanges)
    .values({
      id: randomUUID(),
      importBatchId: batchId,
      entity,
      entityId,
      before: JSON.stringify(previous),
      after: JSON.stringify(next),
    })
    .run();
}

export function listImportBatches() {
  return getDb()
    .select({
      id: importBatches.id,
      fileName: importBatches.fileName,
      importedAt: importBatches.importedAt,
      importedCount: importBatches.transactionCount,
      mergedCount: importBatches.mergedCount,
      status: importBatches.undoneAt,
    })
    .from(importBatches)
    .orderBy(desc(importBatches.importedAt))
    .all()
    .map((batch) => ({
      ...batch,
      status: batch.status ? ("undone" as const) : ("completed" as const),
    }));
}

export function undoImport(batchId: string) {
  const db = getDb();
  db.transaction(
    (tx) => {
      const batch = tx
        .select()
        .from(importBatches)
        .where(eq(importBatches.id, batchId))
        .get();
      if (!batch) throw new Error("インポート履歴が見つかりません。");
      if (batch.undoneAt) throw new Error("このインポートは取り消し済みです。");
      tx.delete(transactionImportSources)
        .where(eq(transactionImportSources.importBatchId, batchId))
        .run();
      const changes = tx
        .select()
        .from(importChanges)
        .where(eq(importChanges.importBatchId, batchId))
        .all()
        .reverse();
      for (const change of changes) {
        const table = change.entity === "stock" ? stocks : transactions;
        const current = tx
          .select()
          .from(table)
          .where(eq(table.id, change.entityId))
          .get();
        if (!current) continue;
        if (change.entity === "stock") {
          // Other active imports still substantiate this stock; retain their identity data.
          const supported = tx
            .select()
            .from(importBatchStocks)
            .innerJoin(
              importBatches,
              eq(importBatches.id, importBatchStocks.batchId),
            )
            .where(
              and(
                eq(importBatchStocks.stockId, change.entityId),
                isNull(importBatches.undoneAt),
              ),
            )
            .all()
            .some((item) => item.import_batches.id !== batchId);
          const laterTransaction = tx
            .select({ id: transactions.id })
            .from(transactions)
            .where(
              and(
                eq(transactions.stockId, change.entityId),
                gt(transactions.createdAt, batch.importedAt),
              ),
            )
            .get();
          const laterDecision = tx
            .select({ id: decisions.id })
            .from(decisions)
            .where(
              and(
                eq(decisions.stockId, change.entityId),
                gt(decisions.createdAt, batch.importedAt),
              ),
            )
            .get();
          const laterReview = tx
            .select({ id: reviews.id })
            .from(reviews)
            .where(
              and(
                eq(reviews.stockId, change.entityId),
                gt(reviews.createdAt, batch.importedAt),
              ),
            )
            .get();
          if (supported || laterTransaction || laterDecision || laterReview)
            continue;
        }
        const before: Record<string, Value> = JSON.parse(change.before);
        const after: Record<string, Value> = JSON.parse(change.after);
        const patch: Record<string, Value> = {};
        for (const [field, value] of Object.entries(after)) {
          if (Object.getOwnPropertyDescriptor(current, field)?.value === value)
            patch[field] = before[field];
        }
        // Name and its normalized form are one value, even after a user's edit.
        if (
          change.entity === "stock" &&
          ("name" in after || "normalizedName" in after)
        ) {
          const name = Object.getOwnPropertyDescriptor(current, "name")?.value;
          const normalized = Object.getOwnPropertyDescriptor(
            current,
            "normalizedName",
          )?.value;
          if (
            ("name" in after && !("name" in patch)) ||
            ("normalizedName" in after && !("normalizedName" in patch)) ||
            normalizeName(name) !== normalized
          ) {
            delete patch.name;
            delete patch.normalizedName;
          } else if (typeof patch.name === "string")
            patch.normalizedName = normalizeName(patch.name);
        }
        if (Object.keys(patch).length)
          tx.update(table)
            .set(patch)
            .where(eq(table.id, change.entityId))
            .run();
      }
      tx.delete(transactions)
        .where(eq(transactions.importBatchId, batchId))
        .run();
      const tracked = tx
        .select()
        .from(importBatchStocks)
        .where(eq(importBatchStocks.batchId, batchId))
        .all();
      for (const item of tracked) {
        if (!item.createdByBatch) continue;
        const transactionRef = tx
          .select({ id: transactions.id })
          .from(transactions)
          .where(eq(transactions.stockId, item.stockId))
          .get();
        const decisionRef = tx
          .select({ id: decisions.id })
          .from(decisions)
          .where(eq(decisions.stockId, item.stockId))
          .get();
        const reviewRef = tx
          .select({ id: reviews.id })
          .from(reviews)
          .where(eq(reviews.stockId, item.stockId))
          .get();
        if (!transactionRef && !decisionRef && !reviewRef)
          tx.delete(stocks).where(eq(stocks.id, item.stockId)).run();
      }
      tx.update(importBatches)
        .set({ undoneAt: new Date().toISOString() })
        .where(eq(importBatches.id, batchId))
        .run();
    },
    { behavior: "immediate" },
  );
}
