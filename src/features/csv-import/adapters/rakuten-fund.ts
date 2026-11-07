import {
  isoDate,
  normalizeAccount,
  normalizeText,
  parseNumber,
} from "../common";
import type {
  Currency,
  ExcludedRow,
  NormalizedTransaction,
  UnknownRow,
} from "../types";

// 楽天の投資信託CSVの「単価」は基準価額で、ファンドにより1口あたりと1万口あたりが混在する
// （eMAXIS Slim は1万口、楽天・マネーファンドと米ドルMMFは1口）。CSVに単位の列はないため、
// 数量×単価が受付・受渡金額と一致する単位を採る。どちらとも一致しない、または両方に一致する行は
// 推測で決めず読み取れない行として返す。
const PRICE_UNITS = [1, 10_000] as const;

function unitPrice(
  quantity: number,
  quotedPrice: number,
  amount: number,
  currency: Currency,
): number | null {
  // 円は1円未満の端数とポイント利用分、米ドルはセント未満の端数を許す
  const tolerance = Math.max(amount * 0.005, currency === "JPY" ? 1 : 0.005);
  const matches = PRICE_UNITS.filter(
    (unit) => Math.abs((quantity * quotedPrice) / unit - amount) <= tolerance,
  );
  return matches.length === 1 ? quotedPrice / matches[0] : null;
}

// 楽天はファンドの表示名を途中で変えることがあり、同じファンドが新旧の名前で CSV に並ぶ。
// 銘柄は名前で照合されるため、旧名を現在の表示名へ寄せて1銘柄にまとめる。
// 末尾の括弧（愛称）を一律に外す方法は「(S&P500)」のような正式名の一部まで消すので採らない。
const FUND_NAME_ALIASES = new Map<string, string>([
  [
    "eMAXIS Slim 全世界株式(オール・カントリー)",
    "eMAXIS Slim 全世界株式(オール・カントリー)(オルカン)",
  ],
]);

function canonicalFundName(value: string): string {
  const name = normalizeText(value);
  return FUND_NAME_ALIASES.get(name) ?? value;
}

// 受渡金額の末尾の「(1)」はポイント利用額。受渡金額そのものには含めない
function parseAmountWithPoints(value: string | undefined): number | null {
  return parseNumber(normalizeText(value).replace(/\(\s*[\d,]+\s*\)$/, ""));
}

function parseCurrency(value: string | undefined): Currency | null {
  const v = normalizeText(value);
  if (["円", "JPY"].includes(v)) return "JPY";
  if (["米ドル", "USドル", "USD"].includes(v)) return "USD";
  return null;
}

export function parseRakutenFund(
  rows: string[][],
  header: number,
  sourceLines = rows.map((_, i) => i + 1),
) {
  const headers = rows[header].map((v) => v.trim());
  const transactions: NormalizedTransaction[] = [],
    excluded: ExcludedRow[] = [],
    unknown: UnknownRow[] = [];
  for (let i = header + 1; i < rows.length; i++) {
    if (rows[i].every((v) => !v.trim())) continue;
    const r = Object.fromEntries(
      headers.map((h, n) => [h, (rows[i][n] ?? "").trim()]),
    );
    const tradeRaw = r["取引"] ?? "";
    const trade = normalizeText(tradeRaw);
    const stockName = canonicalFundName(r["ファンド名"] ?? "");
    const line = sourceLines[i];
    const side =
      trade === "買付" || trade === "再投資"
        ? "buy"
        : trade === "解約" || trade === "売却"
          ? "sell"
          : null;
    if (!side) {
      unknown.push({
        sourceRowNumber: line,
        stockName,
        sourceTradeType: tradeRaw,
        reason: "対応する投資信託の取引区分ではありません。",
      });
      continue;
    }
    const quantity = parseNumber(r["数量［口］"]);
    if (quantity === 0) {
      excluded.push({
        sourceRowNumber: line,
        stockName,
        sourceTradeType: tradeRaw,
        reason: "数量が0口のため対象外です。",
      });
      continue;
    }
    const executedAt = isoDate(r["約定日"]);
    const settlementDate = isoDate(r["受渡日"]);
    const invalidSettlementDate =
      Boolean(r["受渡日"]?.trim()) && !settlementDate;
    const currency = parseCurrency(r["決済通貨"]);
    const quotedPrice = parseNumber(r["単価"]);
    const fee = parseNumber(r["経費"]);
    const exchangeRate = parseNumber(r["為替レート"]);
    const localAmount = parseNumber(r["受付金額[現地通貨]"]);
    const yenAmount = parseAmountWithPoints(r["受渡金額/(ポイント利用)[円]"]);
    const settlementAmount = currency === "USD" ? localAmount : yenAmount;
    const price =
      currency &&
      quantity !== null &&
      Number.isFinite(quantity) &&
      quantity > 0 &&
      quotedPrice !== null &&
      Number.isFinite(quotedPrice) &&
      quotedPrice > 0 &&
      settlementAmount !== null &&
      Number.isFinite(settlementAmount)
        ? unitPrice(quantity, quotedPrice, settlementAmount, currency)
        : null;
    if (
      !executedAt ||
      invalidSettlementDate ||
      !stockName ||
      !currency ||
      quantity === null ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      price === null ||
      Number.isNaN(fee) ||
      (fee !== null && (!Number.isFinite(fee) || fee < 0)) ||
      Number.isNaN(yenAmount) ||
      Number.isNaN(exchangeRate) ||
      (currency === "USD" &&
        (exchangeRate === null ||
          !Number.isFinite(exchangeRate) ||
          exchangeRate <= 0))
    ) {
      unknown.push({
        sourceRowNumber: line,
        stockName,
        sourceTradeType: tradeRaw,
        reason:
          "必須項目、日付、通貨、単価、経費または受渡金額を正しく読み取れません。",
      });
      continue;
    }
    transactions.push({
      marketCode: currency === "USD" ? "US" : "JP",
      ticker: null,
      stockName,
      side,
      quantity,
      price,
      priceCurrency: currency,
      fee,
      feeCurrency: currency,
      executedAt,
      settlementDate,
      accountType: normalizeAccount(r["口座"]),
      settlementCurrency: currency,
      settlementAmount,
      exchangeRate: currency === "USD" ? exchangeRate : null,
      sourceBroker: "rakuten",
      sourceTradeType: tradeRaw,
      sourceRowNumber: line,
      assetClass: "fund",
    });
  }
  return { transactions, excluded, unknown };
}
