import { eq } from "drizzle-orm";

import {
  authorizeIntegrationRequest,
  createMethodNotAllowedHandler,
} from "@/features/integration/auth";
import { toTransaction } from "@/features/integration/mappers";
import {
  errorResponse,
  internalErrorResponse,
  successResponse,
  validationErrorResponse,
} from "@/features/integration/responses";
import { japanDate } from "@/features/transactions/matching";
import { getDb } from "@/lib/db";
import { stocks, transactions } from "@/lib/db/schema";
import { TransactionSchema } from "@/schemas/transaction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function isDateOnly(value: string): boolean {
  if (!datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export async function GET(request: Request) {
  try {
    const authError = authorizeIntegrationRequest(request, "read");
    if (authError) return authError;

    const url = new URL(request.url);
    const stockId = url.searchParams.get("stockId");
    const side = url.searchParams.get("side");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    if (side !== null && side !== "buy" && side !== "sell") {
      return validationErrorResponse(
        "side は buy または sell を指定してください。",
      );
    }
    if (from !== null && !isDateOnly(from)) {
      return validationErrorResponse(
        "from は YYYY-MM-DD 形式の日付で指定してください。",
      );
    }
    if (to !== null && !isDateOnly(to)) {
      return validationErrorResponse(
        "to は YYYY-MM-DD 形式の日付で指定してください。",
      );
    }
    if (from !== null && to !== null && from > to) {
      return validationErrorResponse(
        "from は to 以前の日付を指定してください。",
      );
    }

    if (stockId !== null) {
      const stock = getDb()
        .select({ id: stocks.id })
        .from(stocks)
        .where(eq(stocks.id, stockId))
        .get();
      if (!stock) return errorResponse("not_found");
    }

    const matchingTransactions = getDb()
      .select()
      .from(transactions)
      .all()
      .map((row) => TransactionSchema.parse(row))
      .filter((transaction) => {
        if (stockId !== null && transaction.stockId !== stockId) return false;
        if (side !== null && transaction.side !== side) return false;
        const executedOn = japanDate(transaction.executedAt);
        if (from !== null && executedOn < from) return false;
        if (to !== null && executedOn > to) return false;
        return true;
      })
      .sort(
        (a, b) =>
          b.executedAt.localeCompare(a.executedAt) ||
          b.createdAt.localeCompare(a.createdAt) ||
          a.id.localeCompare(b.id),
      );

    return successResponse({
      transactions: matchingTransactions.map(toTransaction),
    });
  } catch {
    return internalErrorResponse();
  }
}

const methodNotAllowed = createMethodNotAllowedHandler("read");

export {
  methodNotAllowed as POST,
  methodNotAllowed as PUT,
  methodNotAllowed as PATCH,
  methodNotAllowed as DELETE,
  methodNotAllowed as OPTIONS,
  methodNotAllowed as HEAD,
};
