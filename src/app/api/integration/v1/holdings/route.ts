import {
  authorizeIntegrationRequest,
  createMethodNotAllowedHandler,
} from "@/features/integration/auth";
import {
  toCurrencyTotals,
  toValuedHolding,
} from "@/features/integration/mappers";
import {
  internalErrorResponse,
  successResponse,
} from "@/features/integration/responses";
import type { MarketQuote } from "@/features/market-data/provider";
import { marketPriceProvider } from "@/features/market-data/quotes";
import { toQuoteSymbol } from "@/features/market-data/symbols";
import {
  listPortfolioAction,
  listRealizedProfitLossAction,
} from "@/features/portfolio/actions";
import {
  realizedProfitLossForCurrency,
  realizedProfitLossForStock,
} from "@/features/portfolio/portfolio";
import {
  calculateValuation,
  summarizeValuation,
} from "@/features/portfolio/valuation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authError = authorizeIntegrationRequest(request, "read");
    if (authError) return authError;

    const holdings = await listPortfolioAction();
    const realized = await listRealizedProfitLossAction();
    const realizedByStock = new Map(
      holdings.map((holding) => [
        holding.stockId,
        realizedProfitLossForStock(realized, holding.stockId, holding.currency),
      ]),
    );
    const symbols = holdings
      .filter((holding) => holding.quantity > 0)
      .map((holding) => toQuoteSymbol(holding))
      .filter((symbol): symbol is string => symbol !== null);

    let quotes: Map<string, MarketQuote>;
    try {
      quotes = await marketPriceProvider.getQuotes(symbols);
    } catch {
      // 株価取得が失敗しても台帳の保有情報を返す（仕様 §4.2）。
      quotes = new Map();
    }

    const valuedHoldings = calculateValuation(
      holdings,
      quotes,
      realizedByStock,
    );
    const summaries = summarizeValuation(valuedHoldings);
    const sortedHoldings = [...valuedHoldings].sort(
      (a, b) =>
        a.holding.stockName.localeCompare(b.holding.stockName, "ja") ||
        a.holding.stockId.localeCompare(b.holding.stockId),
    );

    return successResponse({
      holdings: sortedHoldings.map(toValuedHolding),
      totalsByCurrency: [
        toCurrencyTotals(
          summaries.JPY,
          realizedProfitLossForCurrency(realized, "JPY"),
        ),
        toCurrencyTotals(
          summaries.USD,
          realizedProfitLossForCurrency(realized, "USD"),
        ),
      ],
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
