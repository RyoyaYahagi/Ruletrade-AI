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
import { toDecision, toReview } from "@/features/integration/mappers";
import {
  errorResponse,
  internalErrorResponse,
  successResponse,
  validationErrorResponse,
} from "@/features/integration/responses";
import { getDb } from "@/lib/db";
import { decisions, reviews, stocks } from "@/lib/db/schema";
import { DecisionSchema } from "@/schemas/decision";
import { ReviewSchema } from "@/schemas/review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REVIEWS_ENDPOINT = "POST /reviews";

const CreateReviewRequestSchema = z.object({
  clientRequestId: z.string().refine(isClientRequestId, {
    message: "clientRequestId は UUID 形式で指定してください。",
  }),
  stockId: ReviewSchema.shape.stockId,
  decisionId: ReviewSchema.shape.decisionId.optional(),
  currentInput: ReviewSchema.shape.currentInput,
  summary: ReviewSchema.shape.summary,
  differences: ReviewSchema.shape.differences,
  reflection: ReviewSchema.shape.reflection,
});

class ReviewStockNotFoundError extends Error {
  constructor() {
    super("指定された銘柄が見つかりません。");
    this.name = "ReviewStockNotFoundError";
  }
}

class ReviewDecisionNotFoundError extends Error {
  constructor() {
    super("指定された判断が見つかりません。");
    this.name = "ReviewDecisionNotFoundError";
  }
}

class ReviewDecisionStockMismatchError extends Error {
  constructor() {
    super("判断と振り返りの銘柄が一致しません。");
    this.name = "ReviewDecisionStockMismatchError";
  }
}

function parseStringArray(value: string): string[] {
  const decoded: unknown = JSON.parse(value);
  if (
    !Array.isArray(decoded) ||
    decoded.some((item) => typeof item !== "string")
  ) {
    throw new Error("Stored review list field is invalid");
  }
  return decoded;
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

    const parsed = CreateReviewRequestSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error.issues[0]?.message);
    }
    const input = parsed.data;
    const decisionId = input.decisionId ?? null;
    // reflection は ReviewSchema が前後の空白だけ trim する。ハッシュには
    // 受信した本文を使い、空白だけが違う再送を衝突として扱う。
    const requestBody = prepareRequestBodyForHash(
      body as Record<string, unknown>,
      { decisionId: null },
    );

    const result = executeIdempotentWrite({
      db: getDb(),
      clientRequestId: input.clientRequestId,
      endpoint: REVIEWS_ENDPOINT,
      requestBody,
      resourceType: "review",
      write: (tx, now) => {
        const stock = tx
          .select({ id: stocks.id })
          .from(stocks)
          .where(eq(stocks.id, input.stockId))
          .get();
        if (!stock) throw new ReviewStockNotFoundError();

        if (decisionId !== null) {
          const decision = tx
            .select({ stockId: decisions.stockId })
            .from(decisions)
            .where(eq(decisions.id, decisionId))
            .get();
          if (!decision) throw new ReviewDecisionNotFoundError();
          if (decision.stockId !== input.stockId) {
            throw new ReviewDecisionStockMismatchError();
          }
        }

        const id = randomUUID();
        tx.insert(reviews)
          .values({
            id,
            stockId: input.stockId,
            decisionId,
            currentInput: input.currentInput,
            summary: input.summary,
            differences: JSON.stringify(input.differences),
            reflection: input.reflection,
            createdAt: now,
            origin: "muse",
          })
          .run();
        return id;
      },
      load: (database, resourceId) => {
        const row = database
          .select()
          .from(reviews)
          .where(eq(reviews.id, resourceId))
          .get();
        if (!row) return null;

        const review = ReviewSchema.parse({
          ...row,
          differences: parseStringArray(row.differences),
        });
        const decision =
          review.decisionId === null
            ? null
            : database
                .select()
                .from(decisions)
                .where(eq(decisions.id, review.decisionId))
                .get();
        return {
          review: toReview(review),
          decision: decision
            ? toDecision(DecisionSchema.parse(mapDecisionRow(decision)))
            : null,
        };
      },
    });

    if (result.kind === "conflict") {
      return errorResponse("idempotency_key_reused");
    }

    return successResponse(
      {
        replayed: result.kind === "replayed",
        review: result.resource.review,
        decision: result.resource.decision,
      },
      result.kind === "created" ? 201 : 200,
    );
  } catch (error) {
    if (
      error instanceof ReviewStockNotFoundError ||
      error instanceof ReviewDecisionNotFoundError
    ) {
      return errorResponse("not_found");
    }
    if (error instanceof ReviewDecisionStockMismatchError) {
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
