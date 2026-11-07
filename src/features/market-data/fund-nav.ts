import "server-only";

import { parseFundNavCsv } from "@/features/market-data/fund-nav-csv";
import type {
  MarketPriceProvider,
  MarketQuote,
} from "@/features/market-data/provider";
import { parseFundSymbol } from "@/features/market-data/symbols";

// 投信総合検索ライブラリーの利用上の注意は、自動的な手段による情報の取得を禁じている。
// 利用者が個人利用として使うと判断したうえで使っている（2026-11-07）。
// 協会への負荷を抑えるため、ファンドごとに6時間は結果を使い回し、問い合わせは1件ずつ順に行う。
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;
const SOURCE_NAME = "投資信託協会";

const cache = new Map<
  string,
  { quote: MarketQuote | null; expiresAt: number }
>();

async function fetchFundNav(symbol: string): Promise<MarketQuote | null> {
  const codes = parseFundSymbol(symbol);
  if (!codes) return null;
  const url = new URL(
    "https://toushin-lib.fwg.ne.jp/FdsWeb/FDST030000/csv-file-download",
  );
  url.searchParams.set("isinCd", codes.isin);
  url.searchParams.set("associFundCd", codes.associationCode);
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    // Content-Type は utf-8 を名乗るが、本文は Shift_JIS で返ってくる
    const text = new TextDecoder("shift_jis").decode(
      await response.arrayBuffer(),
    );
    const nav = parseFundNavCsv(text);
    if (!nav) return null;
    return {
      symbol,
      price: nav.price,
      currency: "JPY",
      priceAt: nav.priceAt,
      marketState: null,
      delayedByMinutes: null,
      sourceName: SOURCE_NAME,
    };
  } catch {
    return null;
  }
}

export const fundNavPriceProvider: MarketPriceProvider = {
  async getQuotes(symbols) {
    const result = new Map<string, MarketQuote>();
    if (process.env.RULETRADE_E2E_DISABLE_MARKET_QUOTES === "1") return result;
    for (const symbol of new Set(symbols)) {
      const now = Date.now();
      let entry = cache.get(symbol);
      if (!entry || entry.expiresAt <= now) {
        entry = {
          quote: await fetchFundNav(symbol),
          expiresAt: now + CACHE_TTL_MS,
        };
        cache.set(symbol, entry);
      }
      if (entry.quote) result.set(symbol, entry.quote);
    }
    return result;
  },
};
