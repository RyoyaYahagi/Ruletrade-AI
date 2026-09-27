import {
  isoDate,
  normalizeAccount,
  normalizeText,
  parseNumber,
} from "../common";
import type { ExcludedRow, NormalizedTransaction, UnknownRow } from "../types";

export function parseNomura(
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
    const tradeRaw = r["取引区分"] ?? "",
      trade = normalizeText(tradeRaw),
      product = normalizeText(r["商品"]),
      stockName = r["銘柄名"] ?? "",
      line = sourceLines[i];
    if (
      ["入金(配当金)", "入金(振込)", "出金(振込)"].includes(trade) ||
      product === "現金"
    ) {
      excluded.push({
        sourceRowNumber: line,
        stockName,
        sourceTradeType: tradeRaw,
        reason: "配当・現金入出金は対象外です。",
      });
      continue;
    }
    if (product !== "株式") {
      unknown.push({
        sourceRowNumber: line,
        stockName,
        sourceTradeType: tradeRaw,
        reason: "株式以外の商品は取引区分を判定できません。",
      });
      continue;
    }
    const side =
      trade === "現物募集" ? "buy" : trade === "現物売却" ? "sell" : null;
    if (!side) {
      unknown.push({
        sourceRowNumber: line,
        stockName,
        sourceTradeType: tradeRaw,
        reason: "対応する株式現物の取引区分ではありません。",
      });
      continue;
    }
    const issuedCurrency = normalizeText(r["発行通貨"]),
      settlementCurrencyText = normalizeText(r["決済通貨"]);
    if (
      (issuedCurrency && !["円", "JPY"].includes(issuedCurrency)) ||
      (settlementCurrencyText &&
        !["円", "JPY"].includes(settlementCurrencyText))
    ) {
      unknown.push({
        sourceRowNumber: line,
        stockName,
        sourceTradeType: tradeRaw,
        reason: "日本円以外の株式取引は現在取り込めません。",
      });
      continue;
    }
    const executedAt = isoDate(r["約定日"]),
      quantity = parseNumber(r["数量"]),
      price = parseNumber(r["単価"]);
    const settlementDate = isoDate(r["受渡日"]),
      invalidSettlementDate = Boolean(r["受渡日"]?.trim()) && !settlementDate,
      fee = parseNumber(r["手数料（税込）"]),
      settlementAmount = parseNumber(r["受渡金額/決済損益"]),
      exchangeRate = parseNumber(r["レート"]);
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
        (!Number.isFinite(exchangeRate) || exchangeRate <= 0))
    ) {
      unknown.push({
        sourceRowNumber: line,
        stockName,
        sourceTradeType: tradeRaw,
        reason:
          "必須項目、日付、通貨、手数料または受渡金額を正しく読み取れません。",
      });
      continue;
    }
    transactions.push({
      marketCode: "JP",
      ticker: normalizeText(r["銘柄コード"]).toUpperCase() || null,
      stockName,
      side,
      quantity,
      price,
      priceCurrency: "JPY",
      fee,
      feeCurrency: "JPY",
      executedAt,
      settlementDate,
      accountType: normalizeAccount(r["預り区分"]),
      settlementCurrency: "JPY",
      settlementAmount,
      exchangeRate,
      sourceBroker: "nomura",
      sourceTradeType: tradeRaw,
      sourceRowNumber: line,
    });
  }
  return { transactions, excluded, unknown };
}
