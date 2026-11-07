"use server";

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { captures, stocks } from "@/lib/db/schema";
import { CaptureInputSchema } from "@/schemas/capture";

export type SaveCaptureResult =
  | { ok: true; captureId: string; createdAt: string }
  | { ok: false; message: string };

export async function saveCaptureAction(
  input: unknown,
): Promise<SaveCaptureResult> {
  const parsed = CaptureInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ??
        "保存する内容を確認してください。",
    };
  }
  const capture = parsed.data;
  const db = getDb();

  try {
    const result = db.transaction((tx) => {
      if (capture.stockId !== null) {
        const stock = tx
          .select({ id: stocks.id })
          .from(stocks)
          .where(eq(stocks.id, capture.stockId))
          .get();
        if (!stock) throw new Error("銘柄が見つかりません。");
      }

      const captureId = randomUUID();
      const createdAt = new Date().toISOString();
      tx.insert(captures)
        .values({
          id: captureId,
          stockId: capture.stockId,
          stockHint: capture.stockHint,
          rawInput: capture.rawInput,
          origin: "web",
          status: "pending",
          decisionId: null,
          createdAt,
          organizedAt: null,
        })
        .run();
      return { captureId, createdAt };
    });

    return { ok: true, ...result };
  } catch {
    return {
      ok: false,
      message: "保存できませんでした。入力内容を確認してもう一度お試しください。",
    };
  }
}
