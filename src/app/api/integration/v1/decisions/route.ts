import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { mapDecisionRow } from "@/features/decisions/decision-mapper";
import {
  authorizeIntegrationRequest,
  createMethodNotAllowedHandler,
} from "@/features/integration/auth";
import {
  executeIdempotentWrite,
  isClientRequestId,
  prepareRequestBodyForHash,
} from "@/features/integration/idempotency";
import { toCapture, toDecision } from "@/features/integration/mappers";
import {
  errorResponse,
  internalErrorResponse,
  successResponse,
  validationErrorResponse,
} from "@/features/integration/responses";
import { japanDate } from "@/features/transactions/matching";
import { getDb } from "@/lib/db";
import { captures, decisions, stocks } from "@/lib/db/schema";
import { CaptureSchema } from "@/schemas/capture";
import { DecisionSchema } from "@/schemas/decision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DECISIONS_ENDPOINT = "POST /decisions";

const CreateDecisionRequestSchema = z.object({
  clientRequestId: z.string().refine(isClientRequestId, {
    message: "clientRequestId は UUID 形式で指定してください。",
  }),
  stockId: DecisionSchema.shape.stockId,
  type: DecisionSchema.shape.type,
  rawInput: DecisionSchema.shape.rawInput.refine(
    (value) => value.trim().length > 0,
    { message: "rawInput は空白以外の文字を含めてください。" },
  ),
  decidedAt: z.iso.date().optional(),
  summary: DecisionSchema.shape.summary,
  points: DecisionSchema.shape.points,
  thesis: DecisionSchema.shape.thesis.optional(),
  assumptions: DecisionSchema.shape.assumptions.optional(),
  reviewConditions: DecisionSchema.shape.reviewConditions.optional(),
  addConditions: DecisionSchema.shape.addConditions.optional(),
  reviewDates: DecisionSchema.shape.reviewDates,
  captureId: z.string().min(1).nullable().optional(),
});

class DecisionStockNotFoundError extends Error {
  constructor() {
    super("指定された銘柄が見つかりません。");
    this.name = "DecisionStockNotFoundError";
  }
}

class DecisionCaptureNotFoundError extends Error {
  constructor() {
    super("指定された受け箱が見つかりません。");
    this.name = "DecisionCaptureNotFoundError";
  }
}

class DecisionCaptureStockMismatchError extends Error {
  constructor() {
    super("受け箱の銘柄と stockId が一致しません。");
    this.name = "DecisionCaptureStockMismatchError";
  }
}

class DecisionCaptureNotPendingError extends Error {
  constructor() {
    super("受け箱はすでに整理済みまたは破棄済みです。");
    this.name = "DecisionCaptureNotPendingError";
  }
}

export async function POST(request: Request) {
  try {
    const authError = authorizeIntegrationRequest(request, "write");
    if (authError) return authError;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return validationErrorResponse("JSON の形式が正しくありません。");
    }

    const parsed = CreateDecisionRequestSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error.issues[0]?.message);
    }
    const input = parsed.data;
    const captureId = input.captureId ?? null;

    // ハッシュは受信した本文の値で作る。Zod の trim・配列の正規化・
    // 今日の補完・summary の thesis fallback は保存時だけ適用する。
    const requestBody = prepareRequestBodyForHash(
      body as Record<string, unknown>,
      {
        decidedAt: null,
        summary: null,
        points: [],
        thesis: null,
        assumptions: [],
        reviewConditions: [],
        addConditions: [],
        reviewDates: [],
        captureId: null,
      },
    );

    const result = executeIdempotentWrite({
      db: getDb(),
      clientRequestId: input.clientRequestId,
      endpoint: DECISIONS_ENDPOINT,
      requestBody,
      resourceType: "decision",
      write: (tx, now) => {
        const stock = tx
          .select({ id: stocks.id })
          .from(stocks)
          .where(eq(stocks.id, input.stockId))
          .get();
        if (!stock) throw new DecisionStockNotFoundError();

        const capture =
          captureId === null
            ? null
            : tx
                .select()
                .from(captures)
                .where(eq(captures.id, captureId))
                .get();
        if (captureId !== null && !capture) {
          throw new DecisionCaptureNotFoundError();
        }
        if (
          capture &&
          capture.stockId !== null &&
          capture.stockId !== input.stockId
        ) {
          throw new DecisionCaptureStockMismatchError();
        }
        if (capture && capture.status !== "pending") {
          throw new DecisionCaptureNotPendingError();
        }

        const reviewDates = [
          ...new Set(
            (input.reviewDates ?? []).map((date) =>
              new Date(date).toISOString(),
            ),
          ),
        ].sort();
        const decisionId = randomUUID();
        tx.insert(decisions)
          .values({
            id: decisionId,
            stockId: input.stockId,
            type: input.type,
            rawInput: input.rawInput,
            transcript: null,
            followUpQuestion: null,
            followUpAnswer: null,
            summary: input.summary ?? input.thesis ?? null,
            points: JSON.stringify(input.points ?? []),
            thesis: input.thesis ?? null,
            assumptions: JSON.stringify(input.assumptions ?? []),
            reviewConditions: JSON.stringify(input.reviewConditions ?? []),
            addConditions: JSON.stringify(input.addConditions ?? []),
            reviewAt: reviewDates[0] ?? null,
            reviewDates: JSON.stringify(reviewDates),
            decidedAt: input.decidedAt ?? japanDate(now),
            createdAt: now,
            origin: "muse",
          })
          .run();

        if (capture) {
          tx.update(captures)
            .set({
              status: "organized",
              decisionId,
              organizedAt: now,
            })
            .where(eq(captures.id, capture.id))
            .run();
        }
        return decisionId;
      },
      load: (database, resourceId) => {
        const row = database
          .select()
          .from(decisions)
          .where(eq(decisions.id, resourceId))
          .get();
        if (!row) return null;

        let capture = null;
        if (captureId !== null) {
          const captureRow = database
            .select()
            .from(captures)
            .where(eq(captures.id, captureId))
            .get();
          if (captureRow) {
            capture = toCapture(CaptureSchema.parse(captureRow));
          }
        }

        return {
          decision: toDecision(DecisionSchema.parse(mapDecisionRow(row))),
          capture,
        };
      },
    });

    if (result.kind === "conflict") {
      return errorResponse("idempotency_key_reused");
    }

    return successResponse(
      {
        replayed: result.kind === "replayed",
        decision: result.resource.decision,
        capture: result.resource.capture,
      },
      result.kind === "created" ? 201 : 200,
    );
  } catch (error) {
    if (
      error instanceof DecisionStockNotFoundError ||
      error instanceof DecisionCaptureNotFoundError
    ) {
      return errorResponse("not_found");
    }
    if (error instanceof DecisionCaptureNotPendingError) {
      return errorResponse("capture_not_pending");
    }
    if (error instanceof DecisionCaptureStockMismatchError) {
      return validationErrorResponse(error.message);
    }
    return internalErrorResponse();
  }
}

const methodNotAllowed = createMethodNotAllowedHandler("write");

export {
  methodNotAllowed as GET,
  methodNotAllowed as PUT,
  methodNotAllowed as PATCH,
  methodNotAllowed as DELETE,
  methodNotAllowed as OPTIONS,
  methodNotAllowed as HEAD,
};
