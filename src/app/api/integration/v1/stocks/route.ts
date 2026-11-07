import { listDecisionStatsAction } from "@/features/decisions/actions";
import {
  authorizeIntegrationRequest,
  createMethodNotAllowedHandler,
} from "@/features/integration/auth";
import { toStock } from "@/features/integration/mappers";
import {
  internalErrorResponse,
  successResponse,
} from "@/features/integration/responses";
import { listPortfolioAction } from "@/features/portfolio/actions";
import { getDb } from "@/lib/db";
import { stocks } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authError = authorizeIntegrationRequest(request, "read");
    if (authError) return authError;

    // The portfolio path can register the spin-off stock identity, so run it
    // before reading the stock rows (same order as the portfolio screen).
    const holdings = await listPortfolioAction();
    const rows = getDb().select().from(stocks).all();
    const stats = await listDecisionStatsAction();
    const heldStockIds = new Set(
      holdings
        .filter((holding) => holding.quantity > 0)
        .map((holding) => holding.stockId),
    );

    const summaries = rows
      .map((row) => {
        const stat = stats.get(row.id);
        return {
          ...toStock(row),
          isHeld: heldStockIds.has(row.id),
          decisionCount: stat?.count ?? 0,
          lastDecidedOn: stat?.lastDecidedOn ?? null,
        };
      })
      .sort(
        (a, b) =>
          a.name.localeCompare(b.name, "ja") || a.id.localeCompare(b.id),
      );

    return successResponse({ stocks: summaries });
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
