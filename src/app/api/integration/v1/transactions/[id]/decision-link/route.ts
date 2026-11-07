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
import { toDecision, toTransaction } from "@/features/integration/mappers";
import {
  errorResponse,
  internalErrorResponse,
  successResponse,
  validationErrorResponse,
} from "@/features/integration/responses";
import { getDb } from "@/lib/db";
import { decisions, transactions } from "@/lib/db/schema";
import { DecisionSchema } from "@/schemas/decision";
import { TransactionSchema } from "@/schemas/transaction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LinkDecisionRequestSchema = z.object({
  clientRequestId: z.string().refine(isClientRequestId, {
    message: "clientRequestId は UUID 形式で指定してください。",
  }),
  decisionId: z.string().min(1, {
    message: "decisionId は空にできません。",
  }),
});

class LinkTransactionNotFoundError extends Error {
  constructor() {
    super("売買が見つかりません。");
    this.name = "LinkTransactionNotFoundError";
  }
}

class LinkDecisionNotFoundError extends Error {
  constructor() {
    super("判断が見つかりません。");
    this.name = "LinkDecisionNotFoundError";
  }
}

class LinkDecisionStockMismatchError extends Error {
  constructor() {
    super("判断と売買の銘柄が一致しません。");
    this.name = "LinkDecisionStockMismatchError";
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const authError = authorizeIntegrationRequest(request, "write");
    if (authError) return authError;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return validationErrorResponse("JSON の形式が正しくありません。");
    }

    const parsed = LinkDecisionRequestSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error.issues[0]?.message);
    }
    const input = parsed.data;
    const { id: transactionId } = await context.params;
    const endpoint = `POST /transactions/${transactionId}/decision-link`;
    const requestBody = prepareRequestBodyForHash(
      body as Record<string, unknown>,
      {},
    );

    let previousDecisionId: string | null = null;
    const result = executeIdempotentWrite({
      db: getDb(),
      clientRequestId: input.clientRequestId,
      endpoint,
      requestBody,
      resourceType: "transaction",
      write: (tx) => {
        const transaction = tx
          .select()
          .from(transactions)
          .where(eq(transactions.id, transactionId))
          .get();
        if (!transaction) throw new LinkTransactionNotFoundError();

        const decision = tx
          .select()
          .from(decisions)
          .where(eq(decisions.id, input.decisionId))
          .get();
        if (!decision) throw new LinkDecisionNotFoundError();
        if (decision.stockId !== transaction.stockId) {
          throw new LinkDecisionStockMismatchError();
        }

        previousDecisionId = transaction.decisionId;
        if (transaction.decisionId !== decision.id) {
          tx.update(transactions)
            .set({ decisionId: decision.id })
            .where(eq(transactions.id, transaction.id))
            .run();
        }
        return transaction.id;
      },
      load: (database, resourceId) => {
        const transaction = database
          .select()
          .from(transactions)
          .where(eq(transactions.id, resourceId))
          .get();
        if (!transaction) return null;

        const decision =
          transaction.decisionId === null
            ? null
            : database
                .select()
                .from(decisions)
                .where(eq(decisions.id, transaction.decisionId))
                .get();
        return {
          transaction: toTransaction(TransactionSchema.parse(transaction)),
          decision: decision
            ? toDecision(DecisionSchema.parse(mapDecisionRow(decision)))
            : null,
        };
      },
    });

    if (result.kind === "conflict") {
      return errorResponse("idempotency_key_reused");
    }

    return successResponse({
      replayed: result.kind === "replayed",
      transaction: result.resource.transaction,
      decision: result.resource.decision,
      previousDecisionId: result.kind === "created" ? previousDecisionId : null,
    });
  } catch (error) {
    if (
      error instanceof LinkTransactionNotFoundError ||
      error instanceof LinkDecisionNotFoundError
    ) {
      return errorResponse("not_found");
    }
    if (error instanceof LinkDecisionStockMismatchError) {
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
