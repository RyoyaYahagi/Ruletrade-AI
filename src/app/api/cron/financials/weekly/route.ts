import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { assertValidCronRequest } from "@/features/notifications/services/cron-auth-service";
import { createDatabaseClient } from "@/lib/db/database-client";
import { createFinancialsProvider } from "@/lib/financials/financials-provider-factory";
import { upsertFinancialStatement } from "@/features/financials/services/financial-statement-service";

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    assertValidCronRequest(request);
    const db = await createDatabaseClient();
    const [positionsResult, watchlistResult] = await Promise.all([
      db.from("portfolio_positions").select("ticker").neq("position_status", "archived").limit(5000),
      db.from("watchlist_items").select("ticker").neq("status", "archived").limit(5000),
    ]);
    if (positionsResult.error || watchlistResult.error) {
      throw positionsResult.error ?? watchlistResult.error;
    }

    const tickers = [...new Set(
      [...(positionsResult.data ?? []), ...(watchlistResult.data ?? [])]
        .map((row) => String(row.ticker ?? "").trim())
        .filter(Boolean),
    )];
    const provider = createFinancialsProvider();
    const statements = await provider.fetchNewStatements({
      tickers,
      sinceDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    });
    for (const statement of statements) {
      await upsertFinancialStatement({
        statement,
        source: provider.name,
      });
    }

    return apiSuccess({
      provider: provider.name,
      requestedCount: tickers.length,
      savedCount: statements.length,
    });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/cron/financials/weekly",
      method: "GET",
    });
  }
}
