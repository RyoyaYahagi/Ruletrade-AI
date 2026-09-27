import {
  isoDate,
  normalizeAccount,
  normalizeText,
  parseNumber,
} from "../common";
import type { ExcludedRow, NormalizedTransaction, UnknownRow } from "../types";

export function parseSbi(
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
    const tradeRaw = r["取引"] ?? "",
      trade = normalizeText(tradeRaw),
      stockName = r["銘柄"] ?? "",
      line = sourceLines[i];
    if (["入庫", "出庫", "配当", "入金", "出金"].includes(trade)) {
      excluded.push({
        sourceRowNumber: line,
        stockName,
        sourceTradeType: tradeRaw,
        reason: "入庫・出庫・配当・現金入出金は対象外です。",
      });
      continue;
    }
    const side = ["株式現物買", "株式現物買(募集)"].includes(trade)
      ? "buy"
      : trade === "株式現物売"
        ? "sell"
        : null;
    if (!side) {
      unknown.push({
        sourceRowNumber: line,
        stockName,
        sourceTradeType: tradeRaw,
        reason: "対応する株式現物の取引区分ではありません。",
      });
      continue;
    }
    const market = normalizeText(r["市場"]);
    if (
      market &&
      market !== "--" &&
      ![
        "東証",
        "東証(外)",
        "札証",
        "名証",
        "福証",
        "東京",
        "大阪",
        "札幌",
        "名古屋",
        "福岡",
        "市場外",
      ].includes(market)
    ) {
      unknown.push({
        sourceRowNumber: line,
        stockName,
        sourceTradeType: tradeRaw,
        reason: "日本株以外の市場は現在取り込めません。",
      });
      continue;
    }
    const executedAt = isoDate(r["約定日"]),
      quantity = parseNumber(r["約定数量"]),
      price = parseNumber(r["約定単価"]);
    const settlementDate = isoDate(r["受渡日"]),
      invalidSettlementDate = Boolean(r["受渡日"]?.trim()) && !settlementDate,
      fee = parseNumber(r["手数料/諸経費等"]),
      settlementAmount = parseNumber(r["受渡金額/決済損益"]);
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
      (settlementAmount !== null && !Number.isFinite(settlementAmount))
    ) {
      unknown.push({
        sourceRowNumber: line,
        stockName,
        sourceTradeType: tradeRaw,
        reason: "必須項目、日付、手数料または受渡金額を正しく読み取れません。",
      });
      continue;
    }
    const accountType = normalizeAccount(r["預り"]);
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
      accountType,
      settlementCurrency: "JPY",
      settlementAmount,
      exchangeRate: null,
      sourceBroker: "sbi",
      sourceTradeType: tradeRaw,
      sourceRowNumber: line,
    });
  }
  return { transactions, excluded, unknown };
}
