import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const testDirectory = mkdtempSync(
  path.join(os.tmpdir(), "ruletrade-csv-reconciliation-test-"),
);
process.env.RULETRADE_DATABASE_PATH = path.join(
  testDirectory,
  "journal.sqlite",
);

const header =
  "約定日,受渡日,銘柄コード,銘柄名,市場名称,口座区分,取引区分,売買区分,数量［株］,単価［円］,手数料［円］,受渡金額［円］";
const row = (values: string[]) => values.join(",");
const csv = (...rows: string[]) =>
  new TextEncoder().encode([header, ...rows].join("\r\n"));
const trade = (overrides: Partial<Record<string, string>> = {}) => {
  const values: Record<string, string> = {
    date: "2026/09/01",
    settlement: "2026/09/03",
    ticker: "1234",
    name: "架空テスト株式会社",
    market: "東証",
    account: "特定",
    type: "現物",
    side: "買付",
    quantity: "10",
    price: "123.5",
    fee: "0",
    amount: "1235",
    ...overrides,
  };
  return row([
    values.date,
    values.settlement,
    values.ticker,
    values.name,
    values.market,
    values.account,
    values.type,
    values.side,
    values.quantity,
    values.price,
    values.fee,
    values.amount,
  ]);
};

describe("CSV reconciliation", () => {
  let dbModule: typeof import("@/lib/db");
  let service: typeof import("@/features/csv-import/service");
  let schema: typeof import("@/lib/db/schema");
  let db: ReturnType<typeof dbModule.getDb>;

  beforeAll(async () => {
    dbModule = await import("@/lib/db");
    service = await import("@/features/csv-import/service");
    schema = await import("@/lib/db/schema");
    db = dbModule.getDb();
  });

  beforeEach(() => {
    db.delete(schema.importBatches).run();
    db.delete(schema.transactions).run();
    db.delete(schema.decisions).run();
    db.delete(schema.stocks).run();
  });

  afterAll(() => {
    dbModule.getDb().$client.close();
    rmSync(testDirectory, { recursive: true, force: true });
  });

  function addManual(
    options: {
      stockId?: string;
      ticker?: string | null;
      name?: string;
      market?: string | null;
      transactionId?: string;
      date?: string;
      createdAt?: string;
      quantity?: number;
      price?: number | null;
    } = {},
  ) {
    const stockId = options.stockId ?? "manual-stock";
    if (
      !db
        .select()
        .from(schema.stocks)
        .all()
        .some((stock) => stock.id === stockId)
    ) {
      const name = options.name ?? "架空テスト株式会社";
      db.insert(schema.stocks)
        .values({
          id: stockId,
          ticker: options.ticker === undefined ? "1234" : options.ticker,
          name,
          normalizedName: name,
          market: options.market === undefined ? "JP" : options.market,
          marketCode: options.market === undefined ? "JP" : options.market,
          createdAt: "2026-01-01T00:00:00.000Z",
        })
        .run();
    }
    const decisionId = `${options.transactionId ?? "manual-transaction"}-decision`;
    db.insert(schema.decisions)
      .values({
        id: decisionId,
        stockId,
        type: "note",
        rawInput: "user note",
        assumptions: "[]",
        reviewConditions: "[]",
        addConditions: "[]",
        createdAt: "2026-01-01T00:00:00.000Z",
      })
      .run();
    const transactionId = options.transactionId ?? "manual-transaction";
    db.insert(schema.transactions)
      .values({
        id: transactionId,
        stockId,
        side: "buy",
        quantity: options.quantity ?? 10,
        price: options.price === undefined ? 123.5 : options.price,
        fee: 0,
        executedAt: options.date ?? "2026-09-01T12:00:00.000Z",
        decisionId,
        createdAt: options.createdAt ?? "2026-02-03T04:05:06.000Z",
      })
      .run();
    return { stockId, transactionId, decisionId };
  }

  it("merges an exact manual match in place and only fills missing price", async () => {
    const manual = addManual({ price: null });
    const bytes = csv(trade());
    const preview = await service.previewCsv(bytes);
    expect(preview.counts.merged).toBe(1);
    const result = await service.importCsv(bytes, "merge.csv", preview.digest);
    const saved = db.select().from(schema.transactions).all();
    expect(result).toMatchObject({ importedCount: 0, mergedCount: 1 });
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      id: manual.transactionId,
      decisionId: manual.decisionId,
      createdAt: "2026-02-03T04:05:06.000Z",
      price: 123.5,
      importBatchId: null,
      sourceFingerprint: null,
    });
    expect(
      db.select().from(schema.transactionImportSources).all(),
    ).toMatchObject([
      { transactionId: manual.transactionId, sourceRowNumber: 2 },
    ]);
  });

  it("keeps a populated manual price when the CSV price is null", async () => {
    addManual({ price: 125 });
    const bytes = csv(trade({ price: "", amount: "" }));
    const preview = await service.previewCsv(bytes);
    expect(preview.counts).toMatchObject({ merged: 1, review: 0, unknown: 0 });
    await service.importCsv(bytes, "null-price.csv", preview.digest);
    expect(db.select().from(schema.transactions).all()[0].price).toBe(125);
    expect(
      db.select().from(schema.transactionImportSources).all(),
    ).toMatchObject([
      { transactionId: "manual-transaction", sourceRowNumber: 2 },
    ]);
  });

  it("undoes a price fill by restoring null and keeping the manual transaction", async () => {
    const manual = addManual({ price: null });
    const bytes = csv(trade());
    const preview = await service.previewCsv(bytes);
    const { batchId } = await service.importCsv(
      bytes,
      "fill-price.csv",
      preview.digest,
    );
    expect(db.select().from(schema.transactions).all()[0].price).toBe(123.5);
    expect(
      db.select().from(schema.transactionImportSources).all(),
    ).toHaveLength(1);
    service.undoImport(batchId);
    expect(db.select().from(schema.transactions).all()).toHaveLength(1);
    expect(db.select().from(schema.transactions).all()[0]).toMatchObject({
      id: manual.transactionId,
      decisionId: manual.decisionId,
      price: null,
    });
    expect(
      db.select().from(schema.transactionImportSources).all(),
    ).toHaveLength(0);
  });

  it("preserves a user's later price edit when undoing an earlier price fill", async () => {
    const manual = addManual({ price: null });
    const bytes = csv(trade());
    const preview = await service.previewCsv(bytes);
    const { batchId } = await service.importCsv(
      bytes,
      "fill-price-edit.csv",
      preview.digest,
    );
    db.update(schema.transactions)
      .set({ price: 150 })
      .where(eq(schema.transactions.id, manual.transactionId))
      .run();
    service.undoImport(batchId);
    expect(db.select().from(schema.transactions).all()[0]).toMatchObject({
      id: manual.transactionId,
      price: 150,
    });
  });

  it("links a fully matching row without changing any manual facts", async () => {
    const manual = addManual();
    db.update(schema.transactions)
      .set({
        priceCurrency: "JPY",
        feeCurrency: "JPY",
        settlementDate: "2026-09-03T12:00:00.000Z",
        settlementCurrency: "JPY",
        settlementAmount: 1235,
        accountType: "特定",
        sourceBroker: "rakuten",
        sourceTradeType: "現物",
      })
      .where(eq(schema.transactions.id, manual.transactionId))
      .run();
    const before = db.select().from(schema.transactions).all()[0];
    const bytes = csv(trade());
    const preview = await service.previewCsv(bytes);
    await service.importCsv(bytes, "all-facts-match.csv", preview.digest);
    expect(db.select().from(schema.transactions).all()[0]).toEqual(before);
    expect(db.select().from(schema.importChanges).all()).toHaveLength(0);
    expect(
      db.select().from(schema.transactionImportSources).all(),
    ).toHaveLength(1);
  });

  it("completes a similar Kioxia name with ticker and market and reverses that enrichment", async () => {
    addManual({ name: "キオクシア", ticker: null, market: null, price: 123.5 });
    const bytes = csv(
      trade({ ticker: "285A", name: "キオクシアホールディングス" }),
    );
    const preview = await service.previewCsv(bytes);
    expect(preview.counts.merged).toBe(1);
    const { batchId } = await service.importCsv(
      bytes,
      "kioxia.csv",
      preview.digest,
    );
    expect(db.select().from(schema.stocks).all()[0]).toMatchObject({
      id: "manual-stock",
      ticker: "285A",
      name: "キオクシアホールディングス",
      market: "JP",
      marketCode: "JP",
    });
    service.undoImport(batchId);
    expect(db.select().from(schema.stocks).all()[0]).toMatchObject({
      id: "manual-stock",
      ticker: null,
      name: "キオクシア",
      market: null,
      marketCode: null,
    });
    expect(db.select().from(schema.transactions).all()).toHaveLength(1);
  });

  it("requires field choices for ticker and price conflicts and applies each chosen value", async () => {
    addManual({ ticker: "9999", price: 100 });
    const bytes = csv(trade({ price: "123.5" }));
    const preview = await service.previewCsv(bytes);
    expect(preview.counts.review).toBe(1);
    await expect(
      service.importCsv(bytes, "conflict.csv", preview.digest),
    ).rejects.toThrow("処理方法");
    await service.importCsv(bytes, "resolved.csv", preview.digest, [
      {
        sourceRowNumber: 2,
        action: "merge",
        transactionId: "manual-transaction",
        fields: { ticker: "manual", price: "csv" },
      },
    ]);
    expect(db.select().from(schema.stocks).all()[0].ticker).toBe("9999");
    expect(db.select().from(schema.transactions).all()[0]).toMatchObject({
      id: "manual-transaction",
      price: 123.5,
    });
  });

  it("accepts the CSV ticker while retaining the manual price and transaction identity", async () => {
    const manual = addManual({ ticker: "9999", price: 100 });
    const bytes = csv(trade());
    const preview = await service.previewCsv(bytes);
    expect(preview.counts.review).toBe(1);
    await service.importCsv(bytes, "csv-ticker.csv", preview.digest, [
      {
        sourceRowNumber: 2,
        action: "merge",
        transactionId: manual.transactionId,
        fields: { ticker: "csv", price: "manual" },
      },
    ]);
    expect(db.select().from(schema.stocks).all()[0].id).toBe(manual.stockId);
    expect(db.select().from(schema.stocks).all()[0].ticker).toBe("1234");
    expect(db.select().from(schema.transactions).all()[0]).toMatchObject({
      id: manual.transactionId,
      decisionId: manual.decisionId,
      createdAt: "2026-02-03T04:05:06.000Z",
      price: 100,
    });
  });

  it("accepts the manual price when resolving a price conflict", async () => {
    const manual = addManual({ price: 100 });
    const bytes = csv(trade());
    const preview = await service.previewCsv(bytes);
    expect(preview.counts.review).toBe(1);
    await service.importCsv(bytes, "manual-price.csv", preview.digest, [
      {
        sourceRowNumber: 2,
        action: "merge",
        transactionId: manual.transactionId,
        fields: { price: "manual" },
      },
    ]);
    expect(db.select().from(schema.transactions).all()[0]).toMatchObject({
      id: manual.transactionId,
      price: 100,
    });
  });

  it("supports new and skip resolutions for reviewed candidates", async () => {
    addManual({
      stockId: "first-stock",
      transactionId: "first-manual",
      price: 100,
    });
    addManual({
      stockId: "second-stock",
      transactionId: "second-manual",
      date: "2026-09-02T12:00:00.000Z",
      ticker: "5678",
      name: "架空別会社株式会社",
      price: 200,
    });
    const first = trade();
    const second = trade({
      date: "2026/09/02",
      settlement: "2026/09/04",
      ticker: "5678",
      name: "架空別会社株式会社",
      price: "201",
    });
    const bytes = csv(first, second);
    const preview = await service.previewCsv(bytes);
    expect(preview.counts.review).toBe(2);
    await service.importCsv(bytes, "choices.csv", preview.digest, [
      { sourceRowNumber: 2, action: "new" },
      { sourceRowNumber: 3, action: "skip" },
    ]);
    expect(
      db
        .select()
        .from(schema.transactions)
        .all()
        .map(({ id }) => id)
        .sort(),
    ).toEqual(["first-manual", "second-manual", expect.any(String)].sort());
    expect(
      db.select().from(schema.transactionImportSources).all(),
    ).toHaveLength(0);
  });

  it("requires review when a row has multiple manual candidates", async () => {
    addManual({ transactionId: "candidate-one" });
    addManual({ transactionId: "candidate-two" });
    const bytes = csv(trade());
    const preview = await service.previewCsv(bytes);
    expect(preview.counts.review).toBe(1);
    expect(preview.rows[0].candidates.map(({ id }) => id).sort()).toEqual([
      "candidate-one",
      "candidate-two",
    ]);
    await expect(
      service.importCsv(bytes, "ambiguous.csv", preview.digest),
    ).rejects.toThrow("処理方法");
  });

  it("rejects explicitly merging repeated rows into the same manual entry", async () => {
    addManual();
    const bytes = csv(trade(), trade({ settlement: "2026/09/04" }));
    const preview = await service.previewCsv(bytes);
    expect(preview.counts.review).toBe(2);
    await expect(
      service.importCsv(bytes, "split.csv", preview.digest, [
        {
          sourceRowNumber: 2,
          action: "merge",
          transactionId: "manual-transaction",
        },
        {
          sourceRowNumber: 3,
          action: "merge",
          transactionId: "manual-transaction",
        },
      ]),
    ).rejects.toThrow("複数CSV行");
    expect(db.select().from(schema.transactions).all()).toHaveLength(1);
  });

  it("does not combine split quantities of 30 and 70 into a manual quantity of 100", async () => {
    addManual({ quantity: 100 });
    const bytes = csv(
      trade({ quantity: "30", price: "10", amount: "300" }),
      trade({ quantity: "70", price: "10", amount: "700" }),
    );
    const preview = await service.previewCsv(bytes);
    expect(preview.counts.review).toBe(2);
    expect(preview.rows.map(({ status }) => status)).toEqual([
      "review",
      "review",
    ]);
    await expect(
      service.importCsv(bytes, "split-quantity.csv", preview.digest),
    ).rejects.toThrow("処理方法");
    expect(db.select().from(schema.transactions).all()).toHaveLength(1);
    expect(db.select().from(schema.transactions).all()[0].quantity).toBe(100);
  });

  it("tracks an exact reimport as duplicate without adding source links or transactions", async () => {
    const manual = addManual();
    const bytes = csv(trade());
    const firstPreview = await service.previewCsv(bytes);
    await service.importCsv(bytes, "first.csv", firstPreview.digest);
    const changesAfterFirstImport = db
      .select()
      .from(schema.importChanges)
      .all().length;
    const again = await service.previewCsv(bytes);
    expect(again.counts).toMatchObject({ merged: 0, duplicate: 1 });
    expect(
      (await service.importCsv(bytes, "again.csv", again.digest)).mergedCount,
    ).toBe(0);
    expect(db.select().from(schema.transactions).all()).toHaveLength(1);
    expect(
      db.select().from(schema.transactionImportSources).all(),
    ).toHaveLength(1);
    expect(db.select().from(schema.importChanges).all()).toHaveLength(
      changesAfterFirstImport,
    );
    expect(db.select().from(schema.transactions).all()[0].id).toBe(
      manual.transactionId,
    );
  });

  it("does not match similarly prefixed Mitsubishi names with the same trading facts", async () => {
    addManual({ name: "三菱商事株式会社", ticker: "9999", price: 123.5 });
    const preview = await service.previewCsv(
      csv(trade({ name: "三菱自動車工業株式会社" })),
    );
    expect(preview.counts.new).toBe(1);
    expect(preview.counts.merged).toBe(0);
    expect(preview.rows[0].candidates).toHaveLength(0);
  });

  it("matches equivalent fractional quantities and execution instants on the same JP date", async () => {
    addManual({ quantity: 1.25, date: "2026-09-01T03:00:00.000Z" });
    const preview = await service.previewCsv(csv(trade({ quantity: "1.25" })));
    expect(preview.counts.merged).toBe(1);
    await service.importCsv(
      csv(trade({ quantity: "1.25" })),
      "fractional.csv",
      preview.digest,
    );
    expect(db.select().from(schema.transactions).all()).toHaveLength(1);
    expect(db.select().from(schema.transactions).all()[0].id).toBe(
      "manual-transaction",
    );
  });

  it("rejects a stale preview after the matched manual transaction is edited", async () => {
    const manual = addManual();
    const bytes = csv(trade());
    const preview = await service.previewCsv(bytes);
    db.update(schema.transactions)
      .set({ price: 130 })
      .where(eq(schema.transactions.id, manual.transactionId))
      .run();
    await expect(
      service.importCsv(bytes, "stale.csv", preview.digest),
    ).rejects.toThrow("再度プレビュー");
    expect(
      db.select().from(schema.transactionImportSources).all(),
    ).toHaveLength(0);
  });

  it("undoes only unchanged imported fields while preserving later manual edits and other batch evidence", async () => {
    addManual({ name: "キオクシア", ticker: null, market: null, price: 123.5 });
    const enrichingBytes = csv(
      trade({ ticker: "285A", name: "キオクシアホールディングス" }),
    );
    const preview = await service.previewCsv(enrichingBytes);
    const { batchId } = await service.importCsv(
      enrichingBytes,
      "enrich.csv",
      preview.digest,
    );
    const laterBytes = csv(
      trade({
        date: "2026/09/05",
        settlement: "2026/09/07",
        ticker: "285A",
        name: "キオクシアホールディングス",
        quantity: "1",
        price: "90",
        amount: "90",
      }),
    );
    const laterPreview = await service.previewCsv(laterBytes);
    const otherBatch = await service.importCsv(
      laterBytes,
      "later.csv",
      laterPreview.digest,
    );
    db.update(schema.stocks)
      .set({ name: "ユーザー編集名", normalizedName: "ユーザー編集名" })
      .where(eq(schema.stocks.id, "manual-stock"))
      .run();
    service.undoImport(batchId);
    expect(db.select().from(schema.stocks).all()[0]).toMatchObject({
      id: "manual-stock",
      ticker: "285A",
      name: "ユーザー編集名",
      marketCode: "JP",
    });
    expect(
      db
        .select()
        .from(schema.transactions)
        .all()
        .map(({ importBatchId }) => importBatchId)
        .sort(),
    ).toEqual([null, otherBatch.batchId].sort());
    expect(
      service.listImportBatches().find(({ id }) => id === batchId)?.status,
    ).toBe("undone");
  });

  it("retains stock enrichment on undo when a later manual transaction references the stock", async () => {
    addManual({ name: "キオクシア", ticker: null, market: null, price: 123.5 });
    const bytes = csv(
      trade({ ticker: "285A", name: "キオクシアホールディングス" }),
    );
    const preview = await service.previewCsv(bytes);
    const { batchId } = await service.importCsv(
      bytes,
      "enrich-with-reference.csv",
      preview.digest,
    );
    addManual({
      transactionId: "later-manual-reference",
      date: "2026-10-01T12:00:00.000Z",
      createdAt: new Date(Date.now() + 5_000).toISOString(),
      quantity: 1,
      price: 90,
    });
    service.undoImport(batchId);
    expect(db.select().from(schema.stocks).all()[0]).toMatchObject({
      id: "manual-stock",
      ticker: "285A",
      name: "キオクシアホールディングス",
      marketCode: "JP",
    });
    expect(
      db
        .select()
        .from(schema.transactions)
        .all()
        .map(({ id }) => id)
        .sort(),
    ).toEqual(["later-manual-reference", "manual-transaction"]);
  });
});
