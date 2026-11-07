import { randomUUID } from "node:crypto";

import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import {
  authorizeIntegrationRequest,
  createMethodNotAllowedHandler,
} from "@/features/integration/auth";
import {
  executeIdempotentWrite,
  isClientRequestId,
  prepareRequestBodyForHash,
} from "@/features/integration/idempotency";
import { toCapture } from "@/features/integration/mappers";
import {
  errorResponse,
  internalErrorResponse,
  successResponse,
  validationErrorResponse,
} from "@/features/integration/responses";
import { getDb } from "@/lib/db";
import { captures, stocks } from "@/lib/db/schema";
import { CaptureInputSchema, CaptureSchema } from "@/schemas/capture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CAPTURES_ENDPOINT = "POST /captures";

const statusValues = new Set(["pending", "organized", "discarded", "all"]);

const CreateCaptureRequestSchema = CaptureInputSchema.extend({
  clientRequestId: z.string().refine(isClientRequestId, {
    message: "clientRequestId は UUID 形式で指定してください。",
  }),
});

class CaptureStockNotFoundError extends Error {
  constructor() {
    super("指定された銘柄が見つかりません。");
    this.name = "CaptureStockNotFoundError";
  }
}

export async function GET(request: Request) {
  try {
    const authError = authorizeIntegrationRequest(request, "read");
    if (authError) return authError;

    const requestedStatus = new URL(request.url).searchParams.get("status");
    if (requestedStatus !== null && !statusValues.has(requestedStatus)) {
      return validationErrorResponse(
        "status は pending / organized / discarded / all のいずれかを指定してください。",
      );
    }
    const status = requestedStatus ?? "pending";

    const rows = getDb()
      .select()
      .from(captures)
      .orderBy(asc(captures.createdAt), asc(captures.id))
      .all()
      .filter((row) => status === "all" || row.status === status)
      .map((row) => CaptureSchema.parse(row));

    return successResponse({ captures: rows.map(toCapture) });
  } catch {
    return internalErrorResponse();
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

    const parsed = CreateCaptureRequestSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error.issues[0]?.message);
    }
    const input = parsed.data;
    const db = getDb();

    const result = executeIdempotentWrite({
      db,
      clientRequestId: input.clientRequestId,
      endpoint: CAPTURES_ENDPOINT,
      requestBody: prepareRequestBodyForHash(body as Record<string, unknown>, {
        stockId: null,
        stockHint: null,
      }),
      resourceType: "capture",
      write: (tx, now) => {
        if (input.stockId !== null) {
          const stock = tx
            .select({ id: stocks.id })
            .from(stocks)
            .where(eq(stocks.id, input.stockId))
            .get();
          if (!stock) throw new CaptureStockNotFoundError();
        }

        const id = randomUUID();
        tx.insert(captures)
          .values({
            id,
            stockId: input.stockId,
            stockHint: input.stockHint,
            rawInput: input.rawInput,
            origin: "muse",
            status: "pending",
            decisionId: null,
            createdAt: now,
            organizedAt: null,
          })
          .run();
        return id;
      },
      load: (database, resourceId) => {
        const row = database
          .select()
          .from(captures)
          .where(eq(captures.id, resourceId))
          .get();
        return row ? toCapture(CaptureSchema.parse(row)) : null;
      },
    });

    if (result.kind === "conflict") {
      return errorResponse("idempotency_key_reused");
    }

    return successResponse(
      {
        replayed: result.kind === "replayed",
        capture: result.resource,
      },
      result.kind === "created" ? 201 : 200,
    );
  } catch (error) {
    if (error instanceof CaptureStockNotFoundError) {
      return errorResponse("not_found");
    }
    return internalErrorResponse();
  }
}

const methodNotAllowed = createMethodNotAllowedHandler("write");

export {
  methodNotAllowed as PUT,
  methodNotAllowed as PATCH,
  methodNotAllowed as DELETE,
  methodNotAllowed as OPTIONS,
  methodNotAllowed as HEAD,
};
