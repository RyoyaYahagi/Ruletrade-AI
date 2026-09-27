import {
  isoDate,
  normalizeAccount,
  normalizeText,
  parseNumber,
} from "../common";
import type { ExcludedRow, NormalizedTransaction, UnknownRow } from "../types";

export function parseRakuten(
  rows: string[][],
  header: number,
  format: "rakuten-jp" | "rakuten-us",
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
    const tradeRaw = r["取引区分"] ?? "";
    const trade = normalizeText(tradeRaw);
    const stockName = r["銘柄名"] ?? "";
    const line = sourceLines[i];
    const sideTextRaw = r["売買区分"] ?? "";
    const sideText = normalizeText(sideTextRaw);
    if (
      ["入庫", "出庫"].includes(trade) ||
      ["入庫", "出庫"].includes(sideText)
    ) {
      excluded.push({
        sourceRowNumber: line,
        stockName,
        sourceTradeType: tradeRaw || sideTextRaw,
        reason: "入庫・出庫は対象外です。",
      });
      continue;
    }
    const allowedTrades = ["現物", "現物(単元未満)", "現物(金額指定)"];
    const side =
      sideText === "買付" ? "buy" : sideText === "売付" ? "sell" : null;
    if (!allowedTrades.includes(trade) || !side) {
      unknown.push({
        sourceRowNumber: line,
        stockName,
        sourceTradeType: tradeRaw || sideTextRaw,
        reason: "対応する現物取引区分ではありません。",
      });
      continue;
    }
    const executedAt = isoDate(r["約定日"]);
    const quantity = parseNumber(
      r[format === "rakuten-jp" ? "数量［株］" : "数量［株］"],
    );
    const price = parseNumber(
      r[format === "rakuten-jp" ? "単価［円］" : "単価［USドル］"],
    );
    const fee = parseNumber(
      r[format === "rakuten-jp" ? "手数料［円］" : "手数料［USドル］"],
    );
    const settlementDate = isoDate(r["受渡日"]);
    const invalidSettlementDate =
      Boolean(r["受渡日"]?.trim()) && !settlementDate;
    const exchangeRaw = normalizeText(r["決済通貨"]);
    const settlementCurrency = !format.endsWith("us")
      ? "JPY"
      : ["円", "JPY"].includes(exchangeRaw)
        ? "JPY"
        : ["USドル", "USD", "米ドル"].includes(exchangeRaw)
          ? "USD"
          : null;
    const settlementField =
      settlementCurrency === "JPY" ? "受渡金額［円］" : "受渡金額［USドル］";
    const settlementAmount = parseNumber(r[settlementField]);
    const exchangeRate = parseNumber(r["為替レート"]);
    if (
      !executedAt ||
      invalidSettlementDate ||
      !stockName ||
      quantity === null ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      (price !== null && (!Number.isFinite(price) || price < 0)) ||
      Number.isNaN(fee) ||
      (fee !== null && (!Number.isFinite(fee) || fee < 0)) ||
      Number.isNaN(settlementAmount) ||
      (settlementAmount !== null && !Number.isFinite(settlementAmount)) ||
      Number.isNaN(exchangeRate) ||
      (exchangeRate !== null &&
        (!Number.isFinite(exchangeRate) || exchangeRate <= 0)) ||
      !settlementCurrency
    ) {
      unknown.push({
        sourceRowNumber: line,
        stockName,
        sourceTradeType: tradeRaw,
        reason:
          "必須項目、日付、通貨、手数料または決済金額を正しく読み取れません。",
      });
      continue;
    }
    const us = format === "rakuten-us";
    transactions.push({
      marketCode: us ? "US" : "JP",
      ticker:
        normalizeText(r[us ? "ティッカー" : "銘柄コード"]).toUpperCase() ||
        null,
      stockName,
      side,
      quantity,
      price,
      priceCurrency: us ? "USD" : "JPY",
      fee,
      feeCurrency: us ? "USD" : "JPY",
      executedAt,
      settlementDate,
      accountType: normalizeAccount(r[us ? "口座" : "口座区分"]),
      settlementCurrency,
      settlementAmount,
      exchangeRate,
      sourceBroker: "rakuten",
      sourceTradeType: tradeRaw || sideTextRaw,
      sourceRowNumber: line,
    });
  }
  return { transactions, excluded, unknown };
}
