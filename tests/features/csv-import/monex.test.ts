import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseCsv } from "@/features/csv-import/parser";
import { parseCsvRecords } from "@/features/csv-import/common";

const fixture = () => readFile("tests/fixtures/csv-import/monex-jp-cp932.csv");

async function modifiedTrade(column: string, value: string) {
  const original = parseCsv(await fixture());
  const [header, first] = parseCsvRecords(original.rawCsv).map(
    ({ cells }) => cells,
  );
  first[header.indexOf(column)] = value;
  return new TextEncoder().encode(
    [header, first]
      .map((row) =>
        row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","),
      )
      .join("\r\n"),
  );
}

describe("Monex transaction history", () => {
  it("decodes CP932 and imports cash, odd-lot and IPO trades with signed settlements", async () => {
    const result = parseCsv(await fixture());
    expect(result).toMatchObject({
      broker: "monex",
      format: "monex-jp",
      rawEncoding: "cp932",
      unknown: [],
    });
    expect(result.transactions.map(({ side }) => side)).toEqual([
      "buy",
      "sell",
      "buy",
      "buy",
      "sell",
      "sell",
      "buy",
    ]);
    expect(result.transactions[0]).toMatchObject({
      marketCode: "JP",
      sourceBroker: "monex",
      ticker: "1234",
      stockName: "架空マネックス株",
      quantity: 2,
      price: 500,
      priceCurrency: "JPY",
      fee: null,
      feeCurrency: null,
      accountType: "特定",
      settlementCurrency: "JPY",
      settlementAmount: -1000,
      executedAt: "2026-09-01T12:00:00.000Z",
      settlementDate: "2026-09-03T12:00:00.000Z",
      sourceRowNumber: 2,
    });
    expect(result.transactions[1].settlementAmount).toBe(990);
    expect(result.excluded).toHaveLength(6);
    expect(
      result.excluded.map(({ sourceTradeType }) => sourceTradeType),
    ).toEqual([
      "国内株式配当",
      "振込入金",
      "振込出金",
      "入庫",
      "出庫",
      "再投資（累投）",
    ]);
  });

  it.each([
    ["取引区分", "株式信用買"],
    ["商品区分", "外国株式"],
    ["市場名", "NASDAQ"],
    ["為替レート", "150"],
    ["為替レート", "不明"],
    ["数量", "0"],
    ["数量", "不明"],
    ["約定価格", "-1"],
    ["約定価格", "不明"],
    ["受渡金額", "不明"],
    ["約定日", "2026/02/30"],
    ["受渡日", "不明"],
    ["銘柄名", ""],
  ])(
    "keeps unsupported or malformed %s=%s out of imported trades",
    async (column, value) => {
      const result = parseCsv(await modifiedTrade(column, value));
      expect(result.transactions).toEqual([]);
      expect(result.unknown).toHaveLength(1);
      expect(result.unknown[0].sourceRowNumber).toBe(2);
    },
  );

  it("supports missing prices and normalizes full-width numbers and accounts", async () => {
    expect(
      parseCsv(await modifiedTrade("約定価格", "－")).transactions[0].price,
    ).toBeNull();
    expect(
      parseCsv(await modifiedTrade("約定価格", "１５４.４０")).transactions[0]
        .price,
    ).toBe(154.4);
    expect(
      parseCsv(await modifiedTrade("口座区分", "NISA成長投資枠"))
        .transactions[0].accountType,
    ).toBe("NISA 成長投資枠");
  });
});
