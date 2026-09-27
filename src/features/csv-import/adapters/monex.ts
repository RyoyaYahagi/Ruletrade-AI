import {
  isoDate,
  normalizeAccount,
  normalizeText,
  parseNumber,
} from "../common";
import type { ExcludedRow, NormalizedTransaction, UnknownRow } from "../types";

export function parseMonex(
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
      stockName = r["銘柄名"] ?? "",
      line = sourceLines[i];
    if (
      normalizeText(r["商品区分"]) === "投信" ||
      ["入庫", "出庫", "国内株式配当", "振込入金", "振込出金"].includes(trade)
    ) {
      excluded.push({
        sourceRowNumber: line,
        stockName,
        sourceTradeType: tradeRaw,
        reason: "投資信託・入庫・出庫・配当・現金入出金は対象外です。",
      });
      continue;
    }
    const side = [
      "株式現物買",
      "株式募集",
      "単元未満株買 店頭",
      "単元未満株買 委託",
    ].includes(trade)
      ? "buy"
      : ["株式現物売", "単元未満株売 店頭", "単元未満株売 委託"].includes(trade)
        ? "sell"
        : null;
    if (normalizeText(r["商品区分"]) !== "株式" || !side) {
      unknown.push({
        sourceRowNumber: line,
        stockName,
        sourceTradeType: tradeRaw,
        reason: "対応する株式現物の取引区分ではありません。",
      });
      continue;
    }
    const market = normalizeText(r["市場名"]);
    if (
      parseNumber(r["為替レート"]) !== null ||
      (market &&
        market !== "-" &&
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
        ].includes(market))
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
      quantity = parseNumber(r["数量"]),
      price = parseNumber(r["約定価格"]);
    const settlementDate = isoDate(r["受渡日"]),
      invalidSettlementDate = Boolean(r["受渡日"]?.trim()) && !settlementDate,
      settlementAmount = parseNumber(r["受渡金額"]);
    if (
      !executedAt ||
      invalidSettlementDate ||
      !stockName ||
      quantity === null ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      (price !== null && (!Number.isFinite(price) || price < 0)) ||
      Number.isNaN(settlementAmount) ||
      (settlementAmount !== null && !Number.isFinite(settlementAmount))
    ) {
      unknown.push({
        sourceRowNumber: line,
        stockName,
        sourceTradeType: tradeRaw,
        reason: "必須項目、日付または受渡金額を正しく読み取れません。",
      });
      continue;
    }
    const accountType = normalizeAccount(r["口座区分"]);
    transactions.push({
      marketCode: "JP",
      ticker: normalizeText(r["銘柄コード"]).toUpperCase() || null,
      stockName,
      side,
      quantity,
      price,
      priceCurrency: "JPY",
      fee: null,
      feeCurrency: null,
      executedAt,
      settlementDate,
      accountType,
      settlementCurrency: "JPY",
      settlementAmount,
      exchangeRate: null,
      sourceBroker: "monex",
      sourceTradeType: tradeRaw,
      sourceRowNumber: line,
    });
  }
  return { transactions, excluded, unknown };
}
