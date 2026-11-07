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
import { yahooMarketPriceProvider } from "@/features/market-data/provider";
import { toYahooSymbol } from "@/features/market-data/symbols";
import { listPortfolioAction } from "@/features/portfolio/actions";
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
    const symbols = holdings
      .filter((holding) => holding.quantity > 0)
      .map((holding) => toYahooSymbol(holding.ticker, holding.marketCode))
      .filter((symbol): symbol is string => symbol !== null);

    let quotes: Map<string, MarketQuote>;
    try {
      quotes = await yahooMarketPriceProvider.getQuotes(symbols);
    } catch {
      quotes = new Map();
    }

    const valuedHoldings = calculateValuation(holdings, quotes);
    const summaries = summarizeValuation(valuedHoldings);
    const sortedHoldings = [...valuedHoldings].sort(
      (a, b) =>
        a.holding.stockName.localeCompare(b.holding.stockName, "ja") ||
        a.holding.stockId.localeCompare(b.holding.stockId),
    );

    return successResponse({
      holdings: sortedHoldings.map(toValuedHolding),
      totalsByCurrency: [
        toCurrencyTotals(summaries.JPY),
        toCurrencyTotals(summaries.USD),
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
