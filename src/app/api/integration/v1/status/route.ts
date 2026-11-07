import { count, max } from "drizzle-orm";

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
import { decisions, reviews, stocks, transactions } from "@/lib/db/schema";

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
        stocks: Number(
          tx.select({ value: count() }).from(stocks).get()?.value ?? 0,
        ),
        decisions: Number(
          tx.select({ value: count() }).from(decisions).get()?.value ?? 0,
        ),
        transactions: Number(
          tx.select({ value: count() }).from(transactions).get()?.value ?? 0,
        ),
        reviews: Number(
          tx.select({ value: count() }).from(reviews).get()?.value ?? 0,
        ),
      },
      latest: {
        stocks:
          tx
            .select({ value: max(stocks.createdAt) })
            .from(stocks)
            .get()?.value ?? null,
        decisions:
          tx
            .select({ value: max(decisions.createdAt) })
            .from(decisions)
            .get()?.value ?? null,
        transactions:
          tx
            .select({ value: max(transactions.createdAt) })
            .from(transactions)
            .get()?.value ?? null,
        reviews:
          tx
            .select({ value: max(reviews.createdAt) })
            .from(reviews)
            .get()?.value ?? null,
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
