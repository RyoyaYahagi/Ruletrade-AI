import { describe, expect, it } from "vitest";

import { initialBucketForImport } from "@/features/csv-import/initial-bucket";
import type { NormalizedTransaction } from "@/features/csv-import/types";

const row = (
  stockName: string,
  extra: Partial<NormalizedTransaction> = {},
): NormalizedTransaction => ({
  marketCode: "JP",
  ticker: null,
  stockName,
  side: "buy",
  quantity: 1,
  price: 1,
  priceCurrency: "JPY",
  fee: 0,
  feeCurrency: "JPY",
  executedAt: "2025-01-01T12:00:00.000Z",
  settlementDate: null,
  accountType: null,
  settlementCurrency: "JPY",
  settlementAmount: 1,
  exchangeRate: null,
  sourceBroker: "rakuten",
  sourceTradeType: "買付",
  sourceRowNumber: 2,
  ...extra,
});

describe("initialBucketForImport", () => {
  it("starts investment funds as core", () => {
    expect(
      initialBucketForImport(
        row("架空インデックスファンド", { assetClass: "fund" }),
      ),
    ).toEqual({ bucket: "core", reason: "取り込み時に自動で設定（投資信託）" });
  });

  it.each([
    "架空 S&P500 ETF",
    "ＮＥＸＴ　ＦＵＮＤＳ　架空指数連動型上場投信",
    "架空ＥＴＦ",
    "VANGUARD TOTAL STOCK MARKET ETF",
  ])("starts %s as core by its ETF name", (name) => {
    expect(initialBucketForImport(row(name))?.bucket).toBe("core");
  });

  it.each(["NETFLIX INC", "架空テスト株式会社", "BETFAIR GROUP"])(
    "leaves %s unclassified",
    (name) => {
      expect(initialBucketForImport(row(name))).toBeNull();
    },
  );
});
