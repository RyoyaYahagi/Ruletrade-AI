import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const testDirectory = mkdtempSync(
  path.join(os.tmpdir(), "ruletrade-csv-import-test-"),
);
process.env.RULETRADE_DATABASE_PATH = path.join(
  testDirectory,
  "journal.sqlite",
);

const syntheticCsv = (trades: string[]) =>
  [
    "約定日,受渡日,銘柄コード,銘柄名,市場名称,口座区分,取引区分,売買区分,数量［株］,単価［円］,手数料［円］,受渡金額［円］",
    ...trades,
  ].join("\r\n");
const fakeTrade =
  "2026/09/01,2026/09/03,1234,架空テスト株式会社,東証,特定,現物,買付,10,123.5,0,1235";
const distinctTrade =
  "2026/09/02,2026/09/04,5678,架空Undo株式会社,東証,一般,現物,買付,2,500,0,1000";
const secondBatchTrade =
  "2026/09/05,2026/09/07,5678,架空Undo株式会社,東証,一般,現物(単元未満),買付,1,510,0,510";

describe("CSV import database service", () => {
  let dbModule: typeof import("@/lib/db");
  let service: typeof import("@/features/csv-import/service");

  beforeAll(async () => {
    dbModule = await import("@/lib/db");
    service = await import("@/features/csv-import/service");
  });

  beforeEach(async () => {
    const db = dbModule.getDb();
    const schema = await import("@/lib/db/schema");
    db.delete(schema.importBatches).run();
    db.delete(schema.transactions).run();
    db.delete(schema.stocks).run();
  });

  afterAll(() => {
    dbModule.getDb().$client.close();
    rmSync(testDirectory, { recursive: true, force: true });
  });

  it("does not write on preview and imports duplicates by matching multiplicity", async () => {
    const csv = syntheticCsv([fakeTrade, fakeTrade]);
    const bytes = new TextEncoder().encode(csv);
    const preview = await service.previewCsv(bytes);
    expect(preview.counts).toMatchObject({ new: 2, duplicate: 0 });
    expect(
      dbModule
        .getDb()
        .select()
        .from((await import("@/lib/db/schema")).transactions)
        .all(),
    ).toHaveLength(0);

    const first = await service.importCsv(
      bytes,
      "synthetic.csv",
      preview.digest,
    );
    expect(first.importedCount).toBe(2);
    await expect(
      service.importCsv(bytes, "stale.csv", preview.digest),
    ).rejects.toThrow("再度プレビュー");
    const secondPreview = await service.previewCsv(bytes);
    expect(secondPreview.counts).toMatchObject({ new: 0, duplicate: 2 });
    expect(
      (await service.importCsv(bytes, "synthetic.csv", secondPreview.digest))
        .importedCount,
    ).toBe(0);
  });

  it("undoes only the selected batch and preserves stocks referenced by manual data", async () => {
    const csv = syntheticCsv([distinctTrade]);
    const { batchId } = await service.importCsv(
      new TextEncoder().encode(csv),
      "one.csv",
    );
    const secondBatch = await service.importCsv(
      new TextEncoder().encode(syntheticCsv([secondBatchTrade])),
      "two.csv",
    );
    const schema = await import("@/lib/db/schema");
    const db = dbModule.getDb();
    const imported = db
      .select()
      .from(schema.transactions)
      .all()
      .find(({ importBatchId }) => importBatchId === batchId);
    expect(imported?.decisionId).toBeNull();
    expect(imported?.importBatchId).toBe(batchId);

    db.insert(schema.transactions)
      .values({
        id: "manual-reference",
        stockId: imported!.stockId,
        side: "buy",
        quantity: 1,
        price: null,
        fee: null,
        executedAt: "2026-09-02T12:00:00.000Z",
        decisionId: null,
        createdAt: "2026-09-02T12:00:00.000Z",
      })
      .run();
    service.undoImport(batchId);

    expect(
      db
        .select()
        .from(schema.transactions)
        .all()
        .map(({ id }) => id)
        .sort(),
    ).toEqual(["manual-reference", expect.any(String)].sort());
    expect(
      db
        .select()
        .from(schema.transactions)
        .all()
        .some(({ importBatchId }) => importBatchId === secondBatch.batchId),
    ).toBe(true);
    expect(db.select().from(schema.stocks).all()).toHaveLength(1);
    expect(
      service.listImportBatches().find(({ id }) => id === batchId),
    ).toMatchObject({
      id: batchId,
      status: "undone",
      importedCount: 1,
    });
  });

  it("rolls back batch rows when a transaction insert fails", async () => {
    const db = dbModule.getDb();
    db.$client.exec(
      `CREATE TRIGGER csv_import_fail BEFORE INSERT ON transactions WHEN NEW.quantity = 2 BEGIN SELECT RAISE(ABORT, 'forced failure'); END;`,
    );
    const beforeStocks = db
      .select()
      .from((await import("@/lib/db/schema")).stocks)
      .all().length;
    try {
      await expect(
        service.importCsv(
          new TextEncoder().encode(syntheticCsv([fakeTrade, distinctTrade])),
          "failed.csv",
        ),
      ).rejects.toThrow("forced failure");
      expect(
        db
          .select()
          .from((await import("@/lib/db/schema")).stocks)
          .all(),
      ).toHaveLength(beforeStocks);
      expect(
        service
          .listImportBatches()
          .some(({ fileName }) => fileName === "failed.csv"),
      ).toBe(false);
    } finally {
      db.$client.exec("DROP TRIGGER IF EXISTS csv_import_fail");
    }
  });

  it("matches a tickerless stock by normalized name and fills a later ticker", async () => {
    const tickerless =
      "2026/09/10,2026/09/12,,架空補完株式会社,東証,特定,現物,買付,3,80,0,240";
    const withTicker =
      "2026/09/11,2026/09/13,9988,架空補完株式会社,東証,特定,現物,買付,4,81,0,324";
    await service.importCsv(
      new TextEncoder().encode(syntheticCsv([tickerless])),
      "tickerless.csv",
    );
    await service.importCsv(
      new TextEncoder().encode(syntheticCsv([withTicker])),
      "ticker.csv",
    );
    const schema = await import("@/lib/db/schema");
    const stocks = dbModule.getDb().select().from(schema.stocks).all();
    expect(stocks).toHaveLength(1);
    expect(stocks[0]).toMatchObject({ ticker: "9988", marketCode: "JP" });
  });

  it("rejects conflicting tickers for the same normalized company name", async () => {
    const first =
      "2026/09/15,2026/09/17,1234,架空衝突株式会社,東証,特定,現物,買付,1,10,0,10";
    const conflict =
      "2026/09/16,2026/09/18,5678,架空衝突株式会社,東証,特定,現物,買付,1,11,0,11";
    await service.importCsv(
      new TextEncoder().encode(syntheticCsv([first])),
      "first.csv",
    );
    await expect(
      service.importCsv(
        new TextEncoder().encode(syntheticCsv([conflict])),
        "conflict.csv",
      ),
    ).rejects.toThrow("別の銘柄コード");
    expect(service.listImportBatches()).toHaveLength(1);
  });
  it("adds only the missing occurrence when one identical trade becomes two", async () => {
    const one = new TextEncoder().encode(syntheticCsv([fakeTrade]));
    const two = new TextEncoder().encode(syntheticCsv([fakeTrade, fakeTrade]));
    await service.importCsv(one, "one.csv");
    expect((await service.previewCsv(two)).counts).toMatchObject({
      new: 1,
      duplicate: 1,
    });
    expect((await service.importCsv(two, "two.csv")).importedCount).toBe(1);
    expect((await service.importCsv(two, "again.csv")).importedCount).toBe(0);
  });

  it("distinguishes accounts, brokers, tickers and changed execution prices", async () => {
    const original = new TextEncoder().encode(syntheticCsv([fakeTrade]));
    await service.importCsv(original, "first.csv");
    const account = fakeTrade.replace("特定", "一般");
    const ticker = fakeTrade.replace("1234,", "9999,");
    const price = fakeTrade.replace("123.5", "124.5");
    const incoming = new TextEncoder().encode(
      syntheticCsv([account, ticker, price]),
    );
    expect((await service.previewCsv(incoming)).counts.new).toBe(3);
    const sbi =
      "約定日,受渡日,銘柄,銘柄コード,市場,取引,約定数量,約定単価,預り,手数料/諸経費等,受渡金額/決済損益\n2026/09/01,2026/09/03,架空テスト株式会社,1234,東証,株式現物買,10,123.5,特定,0,1235";
    expect(
      (await service.previewCsv(new TextEncoder().encode(sbi))).counts.new,
    ).toBe(1);
  });

  it("retains raw CSV and batch counts and deletes only unused automatically created stocks", async () => {
    const csv = syntheticCsv([fakeTrade]);
    const { batchId } = await service.importCsv(
      new TextEncoder().encode(csv),
      "raw.csv",
    );
    const { importBatches, stocks, importBatchStocks } =
      await import("@/lib/db/schema");
    const db = dbModule.getDb();
    expect(db.select().from(importBatches).all()[0]).toMatchObject({
      rawCsv: csv,
      rawEncoding: "utf-8",
      transactionCount: 1,
      duplicateCount: 0,
      excludedCount: 0,
      unknownCount: 0,
    });
    expect(db.select().from(importBatchStocks).all()[0].createdByBatch).toBe(1);
    service.undoImport(batchId);
    expect(db.select().from(stocks).all()).toHaveLength(0);
    expect(service.listImportBatches()[0].status).toBe("undone");
  });

  it("preserves imported stocks referenced by decisions or reviews", async () => {
    const schema = await import("@/lib/db/schema");
    const db = dbModule.getDb();
    const { batchId } = await service.importCsv(
      new TextEncoder().encode(syntheticCsv([fakeTrade, distinctTrade])),
      "references.csv",
    );
    const importedStocks = db.select().from(schema.stocks).all();
    db.insert(schema.decisions)
      .values({
        id: "kept-decision",
        stockId: importedStocks[0].id,
        type: "note",
        rawInput: "架空の記録",
        assumptions: "[]",
        reviewConditions: "[]",
        addConditions: "[]",
        createdAt: "2026-01-01T12:00:00.000Z",
      })
      .run();
    db.insert(schema.reviews)
      .values({
        id: "kept-review",
        stockId: importedStocks[1].id,
        currentInput: "架空の振り返り",
        summary: "概要",
        differences: "[]",
        reflection: "記録",
        createdAt: "2026-01-01T12:00:00.000Z",
      })
      .run();
    service.undoImport(batchId);
    expect(db.select().from(schema.stocks).all()).toHaveLength(2);
    expect(db.select().from(schema.decisions).all()).toHaveLength(1);
    expect(db.select().from(schema.reviews).all()).toHaveLength(1);
  });

  it("matches existing stocks with an unset canonical market and separates JP and US tickers", async () => {
    const { stocks } = await import("@/lib/db/schema");
    const db = dbModule.getDb();
    db.insert(stocks)
      .values({
        id: "legacy",
        ticker: "1234",
        name: "架空テスト株式会社",
        normalizedName: "架空テスト株式会社",
        market: "JP",
        createdAt: "2026-01-01T12:00:00.000Z",
      })
      .run();
    await service.importCsv(
      new TextEncoder().encode(syntheticCsv([fakeTrade])),
      "jp.csv",
    );
    expect(db.select().from(stocks).all()).toMatchObject([
      { id: "legacy", marketCode: "JP" },
    ]);
    const us =
      "約定日,受渡日,ティッカー,銘柄名,取引区分,売買区分,数量［株］,単価［USドル］,決済通貨\n2026/09/01,2026/09/03,1234,架空テスト株式会社,現物,買付,10,123.5,USドル";
    await service.importCsv(new TextEncoder().encode(us), "us.csv");
    expect(
      db
        .select()
        .from(stocks)
        .all()
        .map((stock) => stock.marketCode)
        .sort(),
    ).toEqual(["JP", "US"]);
  });
});
