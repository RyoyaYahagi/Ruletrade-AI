import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  CsvFormatError,
  normalizeName,
  parseCsv,
} from "@/features/csv-import/parser";

const fixture = async (name: string) =>
  new Uint8Array(await readFile(`tests/fixtures/csv-import/${name}`));

describe("CSV import parser", () => {
  it("parses Rakuten Japanese trades and excludes transfer rows", async () => {
    const result = parseCsv(await fixture("rakuten-jp.csv"));
    expect(result.format).toBe("rakuten-jp");
    expect(result.transactions.map(({ side }) => side)).toEqual([
      "buy",
      "sell",
    ]);
    expect(result.transactions[0]).toMatchObject({
      ticker: "1234",
      quantity: 10,
      priceCurrency: "JPY",
      accountType: "特定",
    });
    expect(result.excluded).toHaveLength(1);
  });

  it("keeps US execution price in USD and records JPY settlement details", async () => {
    const result = parseCsv(await fixture("rakuten-us.csv"));
    expect(result.format).toBe("rakuten-us");
    expect(result.transactions[0]).toMatchObject({
      marketCode: "US",
      quantity: 1.5,
      price: 12.34,
      priceCurrency: "USD",
      settlementCurrency: "JPY",
      settlementAmount: 2849,
      exchangeRate: 151.86,
    });
    expect(result.transactions[1].settlementCurrency).toBe("USD");
  });

  it("parses Rakuten investment-fund trades with per-unit prices", async () => {
    expect(() => parseCsv(new Uint8Array(Buffer.from("")))).toThrow();
    const result = parseCsv(await fixture("rakuten-investment-fund.csv"));
    expect(result.format).toBe("rakuten-investment-fund");
    expect(result.transactions).toHaveLength(4);
    const [buy, sell, reinvest, usd] = result.transactions;
    expect(buy).toMatchObject({
      sourceBroker: "rakuten",
      marketCode: "JP",
      ticker: null,
      stockName: "架空インデックスファンド",
      side: "buy",
      quantity: 15482,
      priceCurrency: "JPY",
      settlementCurrency: "JPY",
      settlementAmount: 50000,
      exchangeRate: null,
      accountType: "NISA つみたて投資枠",
      sourceTradeType: "買付",
    });
    // 基準価額は1万口あたりの値なので1口あたりに直す
    expect(buy.price).toBeCloseTo(3.2297);
    expect(sell).toMatchObject({ side: "sell", quantity: 5000, price: 3 });
    expect(reinvest).toMatchObject({
      side: "buy",
      price: 1,
      fee: 16,
      sourceTradeType: "再投資",
    });
    expect(usd).toMatchObject({
      marketCode: "US",
      quantity: 38600,
      price: 0.01,
      priceCurrency: "USD",
      settlementCurrency: "USD",
      settlementAmount: 386,
      exchangeRate: 154.34,
    });
    expect(result.excluded).toEqual([
      expect.objectContaining({
        stockName: "架空米ドルMMF",
        reason: "数量が0口のため対象外です。",
      }),
    ]);
    // 数量×単価が受渡金額と一致する単位がない行は推測せず読み取れない行にする
    expect(result.unknown).toEqual([
      expect.objectContaining({ stockName: "架空バランスファンド" }),
    ]);
  });

  it("rejects an investment-fund row whose price unit is ambiguous", () => {
    const bytes = new TextEncoder().encode(
      "約定日,受渡日,ファンド名,分配金,口座,取引,買付方法,数量［口］,単価,経費,為替レート,受付金額[現地通貨],受渡金額/(ポイント利用)[円],決済通貨\n" +
        '"2025/5/12","2025/5/13","架空米ドルMMF","累積投資","特定","買付","","1","0.01","0.00","154.34","0.01","1","米ドル"\n' +
        '"2025/5/12","2025/5/13","架空ファンド","累積投資","特定","分配金","","1","1","0","-","-","1","円"\n',
    );
    const result = parseCsv(bytes);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].price).toBe(0.01);
    expect(result.unknown).toEqual([
      expect.objectContaining({
        sourceTradeType: "分配金",
        reason: "対応する投資信託の取引区分ではありません。",
      }),
    ]);
  });

  it("finds SBI's real header after preamble and normalizes IPO offers as buys", async () => {
    const result = parseCsv(await fixture("sbi-jp.csv"));
    expect(result.transactions[0]).toMatchObject({
      sourceBroker: "sbi",
      side: "buy",
      sourceTradeType: "株式現物買(募集)",
    });
    expect(result.transactions[1].side).toBe("sell");
  });

  it("finds Nomura's full header and accepts IPO rows without a ticker", async () => {
    const result = parseCsv(await fixture("nomura-jp.csv"));
    expect(result.transactions[0]).toMatchObject({
      sourceBroker: "nomura",
      ticker: null,
      side: "buy",
      stockName: "架空銀行",
    });
    expect(result.excluded).toHaveLength(1);
  });

  it("decodes UTF-8 BOM, handles quoted commas and normalizes names", () => {
    const bytes = new TextEncoder().encode(
      '\uFEFF約定日,受渡日,ティッカー,銘柄名,口座,取引区分,売買区分,決済通貨,数量［株］,単価［USドル］,手数料［USドル］,税金［USドル］,受渡金額［USドル］,受渡金額［円］,為替レート\n2025/02/10,2025/02/12,FAKE,"FICTIONAL, CORP",特定,現物,買付,ＵＳドル,1,12.5,0,0,12.5,,\n',
    );
    const result = parseCsv(bytes);
    expect(result.rawEncoding).toBe("utf-8-bom");
    expect(result.transactions[0].stockName).toBe("FICTIONAL, CORP");
    expect(normalizeName(" ＡＢＣ  株式会社 ")).toBe("abc 株式会社");
  });

  it("routes unrecognized categories and invalid values to unknown without guessing", () => {
    const csv =
      "約定日,受渡日,銘柄コード,銘柄名,市場名称,口座区分,取引区分,売買区分,信用区分,数量［株］,単価［円］,手数料［円］,受渡金額［円］\n2025/01/10,2025/01/14,1234,架空株,東証,特定,現物,買付手数料,,1,10,0,10\n2025/01/10,2025/01/14,1234,架空株,東証,特定,現物,買付,,1,-10,0,10\n2025/01/10,不正日付,1234,架空株,東証,特定,現物,買付,,1,10,不明,10\n";
    const result = parseCsv(new TextEncoder().encode(csv));
    expect(result.transactions).toHaveLength(0);
    expect(result.unknown).toHaveLength(3);
  });

  it("preserves physical source lines and decodes CP932 bytes", () => {
    const csv =
      "\n約定日,受渡日,銘柄コード,銘柄名,市場名称,口座区分,取引区分,売買区分,信用区分,数量［株］,単価［円］,手数料［円］,受渡金額［円］\n2025/01/10,2025/01/14,1234,架空株,東証,特定,現物,買付,,1,10,0,10\n";
    const result = parseCsv(new TextEncoder().encode(csv));
    expect(result.transactions[0].sourceRowNumber).toBe(3);
    expect(() => parseCsv(Uint8Array.from([0x82, 0xa0]))).toThrow(
      CsvFormatError,
    );
  });

  it("rejects unknown formats and files larger than 10 MB", () => {
    expect(() => parseCsv(new TextEncoder().encode("a,b\n1,2"))).toThrow(
      "CSV形式を判定できませんでした",
    );
    expect(() => parseCsv(new Uint8Array(10 * 1024 * 1024 + 1))).toThrow(
      "10 MB",
    );
  });
  it("decodes a complete artificial CP932 statement", async () => {
    const parsed = parseCsv(await fixture("rakuten-jp-cp932.csv"));
    expect(parsed.rawEncoding).toBe("cp932");
    expect(parsed.transactions).toHaveLength(2);
    expect(parsed.transactions[0].stockName).toBe("架空テクノロジー");
  });

  it("rejects malformed quotes and preserves escaped quotes and embedded newlines", async () => {
    const csv = new TextDecoder().decode(await fixture("rakuten-us.csv"));
    const quoted = csv.replace(
      "FICTIONAL CORP",
      '\"FICTIONAL, \"\"CORP\"\"\r\nLINE\"',
    );
    const result = parseCsv(new TextEncoder().encode(quoted));
    expect(result.transactions[0].stockName).toBe('FICTIONAL, "CORP"\r\nLINE');
    expect(result.transactions[1].sourceRowNumber).toBe(4);
    expect(() =>
      parseCsv(
        new TextEncoder().encode(csv.replace("FICTIONAL CORP", '\"BROKEN')),
      ),
    ).toThrow("引用符");
  });

  it("excludes all known transfer, dividend and cash rows", async () => {
    const jp = new TextDecoder().decode(await fixture("rakuten-jp.csv"));
    const jpRows = jp.trim().split("\n");
    const transfer = jpRows[1].replace("買付", "入庫");
    const out = jpRows[1].replace("買付", "出庫");
    expect(
      parseCsv(new TextEncoder().encode([jpRows[0], transfer, out].join("\n")))
        .excluded,
    ).toHaveLength(2);
    const nomura = new TextDecoder().decode(await fixture("nomura-jp.csv"));
    const cashRow = nomura.trim().split("\n").at(-1)!;
    const cashCsv = `${nomura}\n${cashRow.replace("入金（配当金）", "入金（振込）")}\n${cashRow.replace("入金（配当金）", "出金（振込）")}`;
    expect(parseCsv(new TextEncoder().encode(cashCsv)).excluded).toHaveLength(
      3,
    );
  });

  it("normalizes numeric formatting and accounts and refuses unknown currencies", async () => {
    const csv = new TextDecoder().decode(await fixture("rakuten-us.csv"));
    const unknown = csv.replace(",円,", ",EUR,");
    const rejected = parseCsv(new TextEncoder().encode(unknown));
    expect(rejected.unknown).toHaveLength(1);
    expect(rejected.transactions).toHaveLength(1);
    const normalized = csv
      .replace(",1.5,12.34,", ",１.５,１２.３４,")
      .replace("NISA成長投資枠", "NISA預り（成長投資枠）");
    const parsed = parseCsv(new TextEncoder().encode(normalized));
    expect(parsed.transactions[0]).toMatchObject({
      quantity: 1.5,
      price: 12.34,
      fee: 0.25,
      feeCurrency: "USD",
    });
    expect(parsed.transactions[1].accountType).toBe("NISA 成長投資枠");
  });
});

describe("optional CSV execution price", () => {
  it.each([
    ["rakuten-jp.csv", "単価［円］"],
    ["rakuten-us.csv", "単価［USドル］"],
    ["sbi-jp.csv", "約定単価"],
    ["nomura-jp.csv", "単価"],
  ])(
    "accepts a blank price and rejects invalid prices in %s",
    async (file, column) => {
      const original = await readFile(
        `tests/fixtures/csv-import/${file}`,
        "utf8",
      );
      const lines = original.split(/\r?\n/);
      const header = lines.find((line) => line.split(",").includes(column))!;
      const priceIndex = header.split(",").indexOf(column);
      const rewritePrice = (price: string) =>
        new TextEncoder().encode(
          lines
            .map((line) => {
              if (!/^\d{4}\//.test(line)) return line;
              const cells = line.split(",");
              cells[priceIndex] = price;
              return cells.join(",");
            })
            .join("\n"),
        );
      const blank = parseCsv(rewritePrice(""));
      const parsedOriginal = parseCsv(new TextEncoder().encode(original));
      expect(blank.transactions).toHaveLength(
        parsedOriginal.transactions.length,
      );
      expect(
        blank.transactions.every((transaction) => transaction.price === null),
      ).toBe(true);
      expect(blank.unknown).toHaveLength(0);
      for (const price of ["not-a-number", "-1"]) {
        const invalid = parseCsv(rewritePrice(price));
        expect(invalid.transactions).toHaveLength(0);
        expect(invalid.unknown).toHaveLength(
          parsedOriginal.transactions.length,
        );
      }
    },
  );
});

describe("SBI domestic off-exchange market labels", () => {
  const bytes = (market: string) =>
    new TextEncoder().encode(
      [
        ...Array.from({ length: 8 }, () => ""),
        "約定日,銘柄,銘柄コード,市場,取引,期限,預り,課税,約定数量,約定単価,手数料/諸経費等,税額,受渡日,受渡金額/決済損益",
        "",
        "",
        `"2026/06/11","架空国内銀行","1234","${market}",株式現物売,"--"," 特定 ","申告",10,1500,--,--,"2026/06/15",15000`,
      ].join("\r\n"),
    );

  it.each(["東証（外）", "東証(外)"])(
    "imports %s as a Japanese equity sale",
    (market) => {
      const parsed = parseCsv(bytes(market));
      expect(parsed.unknown).toEqual([]);
      expect(parsed.transactions).toMatchObject([
        {
          sourceRowNumber: 12,
          marketCode: "JP",
          side: "sell",
          ticker: "1234",
          quantity: 10,
          price: 1500,
          fee: null,
        },
      ]);
    },
  );

  it.each(["NYSE", "NASDAQ", "東証（外国）"])(
    "continues to reject unsupported market %s",
    (market) => {
      const parsed = parseCsv(bytes(market));
      expect(parsed.transactions).toHaveLength(0);
      expect(parsed.unknown).toMatchObject([
        {
          sourceRowNumber: 12,
          reason: "日本株以外の市場は現在取り込めません。",
        },
      ]);
    },
  );
});
