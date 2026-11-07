"use server";

import { randomUUID } from "node:crypto";

import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import {
  FUND_ASSOCIATION_CODE_PATTERN,
  FUND_ISIN_PATTERN,
} from "@/features/market-data/symbols";
import { getDb } from "@/lib/db";
import { stockBucketChanges, stocks } from "@/lib/db/schema";
import {
  BucketSchema,
  StockBucketChangeSchema,
  type Bucket,
  type StockBucketChange,
} from "@/schemas/stock";

const ChangeStockBucketInputSchema = z.object({
  stockId: z.string().min(1),
  bucket: BucketSchema,
  reason: z.string().trim().max(500).nullish(),
});

export type ChangeStockBucketResult =
  | { ok: true; changed: boolean; bucket: Bucket }
  | { ok: false; message: string };

export async function changeStockBucketAction(
  input: unknown,
): Promise<ChangeStockBucketResult> {
  const parsed = ChangeStockBucketInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "区分を確認してください。",
    };
  }
  const { stockId, bucket } = parsed.data;
  const reason = parsed.data.reason?.trim() || null;

  try {
    return getDb().transaction((tx) => {
      const existing = tx
        .select()
        .from(stocks)
        .where(eq(stocks.id, stockId))
        .get();
      if (!existing) {
        return { ok: false as const, message: "銘柄が見つかりません。" };
      }
      if (existing.bucket === bucket) {
        return { ok: true as const, changed: false, bucket };
      }
      tx.insert(stockBucketChanges)
        .values({
          id: randomUUID(),
          stockId,
          fromBucket: existing.bucket,
          toBucket: bucket,
          reason,
          changedAt: new Date().toISOString(),
        })
        .run();
      tx.update(stocks).set({ bucket }).where(eq(stocks.id, stockId)).run();
      return { ok: true as const, changed: true, bucket };
    });
  } catch {
    return {
      ok: false,
      message: "区分を変更できませんでした。時間をおいて再度お試しください。",
    };
  }
}

export async function listStockBucketHistoryAction(
  stockId: string,
): Promise<StockBucketChange[]> {
  return getDb()
    .select()
    .from(stockBucketChanges)
    .where(eq(stockBucketChanges.stockId, stockId))
    .orderBy(asc(stockBucketChanges.changedAt), asc(stockBucketChanges.id))
    .all()
    .map((row) => StockBucketChangeSchema.parse(row));
}

const SetStockFundCodesInputSchema = z
  .object({
    stockId: z.string().min(1),
    fundIsin: z
      .string()
      .trim()
      .toUpperCase()
      .regex(
        FUND_ISIN_PATTERN,
        "ISINコードは JP から始まる12桁で入力してください。",
      )
      .or(z.literal("")),
    fundAssociationCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(
        FUND_ASSOCIATION_CODE_PATTERN,
        "協会コードは英数字8桁で入力してください。",
      )
      .or(z.literal("")),
  })
  .refine(
    ({ fundIsin, fundAssociationCode }) =>
      (fundIsin === "") === (fundAssociationCode === ""),
    "ISINコードと協会コードは両方を入力するか、両方を空にしてください。",
  );

export type SetStockFundCodesResult =
  | { ok: true; fundIsin: string | null; fundAssociationCode: string | null }
  | { ok: false; message: string };

export async function setStockFundCodesAction(
  input: unknown,
): Promise<SetStockFundCodesResult> {
  const parsed = SetStockFundCodesInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "コードを確認してください。",
    };
  }
  const { stockId } = parsed.data;
  const fundIsin = parsed.data.fundIsin || null;
  const fundAssociationCode = parsed.data.fundAssociationCode || null;
  const db = getDb();
  const existing = db.select().from(stocks).where(eq(stocks.id, stockId)).get();
  if (!existing) return { ok: false, message: "銘柄が見つかりません。" };
  db.update(stocks)
    .set({ fundIsin, fundAssociationCode })
    .where(eq(stocks.id, stockId))
    .run();
  return { ok: true, fundIsin, fundAssociationCode };
}
