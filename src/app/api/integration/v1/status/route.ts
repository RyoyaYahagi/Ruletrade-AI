import { count, eq, max } from "drizzle-orm";

import packageJson from "../../../../../../package.json";
import {
  authorizeIntegrationRequest,
  createMethodNotAllowedHandler,
} from "@/features/integration/auth";
import {
  internalErrorResponse,
  successResponse,
} from "@/features/integration/responses";
import { getDb } from "@/lib/db";
import {
  captures,
  decisions,
  reviews,
  stocks,
  transactions,
} from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authError = authorizeIntegrationRequest(request, "read");
    if (authError) return authError;

    const data = getDb().transaction((tx) => ({
      apiVersion: "v1" as const,
      appVersion: packageJson.version,
      counts: {
        capturesPending: tx
          .select({ value: count() })
          .from(captures)
          .where(eq(captures.status, "pending"))
          .get()!.value,
        stocks: tx.select({ value: count() }).from(stocks).get()!.value,
        decisions: tx.select({ value: count() }).from(decisions).get()!.value,
        transactions: tx.select({ value: count() }).from(transactions).get()!
          .value,
        reviews: tx.select({ value: count() }).from(reviews).get()!.value,
      },
      latest: {
        captures: tx
          .select({ value: max(captures.createdAt) })
          .from(captures)
          .get()!.value,
        stocks: tx
          .select({ value: max(stocks.createdAt) })
          .from(stocks)
          .get()!.value,
        decisions: tx
          .select({ value: max(decisions.createdAt) })
          .from(decisions)
          .get()!.value,
        transactions: tx
          .select({ value: max(transactions.createdAt) })
          .from(transactions)
          .get()!.value,
        reviews: tx
          .select({ value: max(reviews.createdAt) })
          .from(reviews)
          .get()!.value,
      },
    }));

    return successResponse(data);
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
