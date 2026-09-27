import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const testDirectory = mkdtempSync(
  path.join(os.tmpdir(), "ruletrade-portfolio-adjustments-"),
);
process.env.RULETRADE_DATABASE_PATH = path.join(
  testDirectory,
  "journal.sqlite",
);

const header =
  "約定日,受渡日,銘柄コード,銘柄名,市場名称,口座区分,取引区分,売買区分,数量［株］,単価［円］,手数料［円］,受渡金額［円］";
const csv = (...rows: string[]) =>
  new TextEncoder().encode([header, ...rows].join("\r\n"));
const rakutenRow = (options: {
  date: string;
  ticker: string;
  name: string;
  quantity: number;
  price: number;
}) =>
  [
    options.date,
    options.date,
    options.ticker,
    options.name,
    "東証",
    "特定",
    "現物",
    "買付",
    options.quantity,
    options.price,
    0,
    options.quantity * options.price,
  ].join(",");

describe("portfolio corporate action adjustments", () => {
  let dbModule: typeof import("@/lib/db");
  let service: typeof import("@/features/csv-import/service");
  let schema: typeof import("@/lib/db/schema");
  let portfolio: typeof import("@/features/portfolio/actions");
  let db: ReturnType<typeof dbModule.getDb>;

  beforeAll(async () => {
    dbModule = await import("@/lib/db");
    service = await import("@/features/csv-import/service");
    schema = await import("@/lib/db/schema");
    portfolio = await import("@/features/portfolio/actions");
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

  async function importCsv(bytes: Uint8Array, fileName: string) {
    const preview = await service.previewCsv(bytes);
    return service.importCsv(bytes, fileName, preview.digest);
  }

  it("applies a split on reads, keeps imported trades unchanged, and follows import undo", async () => {
    const bytes = csv(
      rakutenRow({
        date: "2026/06/26",
        ticker: "5801",
        name: "古河電気工業",
        quantity: 10,
        price: 1000,
      }),
    );
    const { batchId } = await importCsv(bytes, "furukawa-split.csv");
    const originalTransactions = db.select().from(schema.transactions).all();
    expect(originalTransactions).toHaveLength(1);
    expect(originalTransactions[0]).toMatchObject({
      quantity: 10,
      price: 1000,
    });

    const firstRead = await portfolio.listPortfolioAction();
    expect(firstRead).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ticker: "5801",
          quantity: 100,
          averagePurchasePrice: 100,
          acquisitionAmount: 10000,
          adjustments: expect.arrayContaining([
            "株式分割（1株→10株）を反映済み",
          ]),
        }),
      ]),
    );
    expect(await portfolio.listPortfolioAction()).toEqual(firstRead);
    expect(db.select().from(schema.transactions).all()).toEqual(
      originalTransactions,
    );

    service.undoImport(batchId);
    expect(await portfolio.listPortfolioAction()).toEqual([]);
  });

  it("creates a missing spin-off stock identity and combines its later sale with delivered shares", async () => {
    const bytes = csv(
      rakutenRow({
        date: "2025/09/26",
        ticker: "6758",
        name: "ソニーグループ",
        quantity: 5.5,
        price: 1000,
      }),
    );
    const { batchId } = await importCsv(bytes, "sony-spin-off.csv");
    const originalTransactions = db.select().from(schema.transactions).all();
    const parentAndChild = await portfolio.listPortfolioAction();

    expect(parentAndChild).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ticker: "6758",
          quantity: 5.5,
          averagePurchasePrice: 794,
          acquisitionAmount: 4367,
          adjustments: expect.arrayContaining([
            "スピンオフ（取得額20.6%を子銘柄へ移転）を反映済み",
          ]),
        }),
        expect.objectContaining({
          stockId: "corporate-action-sony-financial-8729",
          ticker: "8729",
          stockName: "ソニーフィナンシャルグループ",
          quantity: 5.5,
          averagePurchasePrice: 206,
          acquisitionAmount: 1133,
          adjustments: expect.arrayContaining([
            "スピンオフ（親銘柄1株につき1株）を反映済み",
          ]),
        }),
      ]),
    );
    expect(
      db
        .select()
        .from(schema.stocks)
        .all()
        .some((stock) => stock.id === "corporate-action-sony-financial-8729"),
    ).toBe(true);
    expect(await portfolio.listPortfolioAction()).toEqual(parentAndChild);
    expect(db.select().from(schema.transactions).all()).toEqual(
      originalTransactions,
    );

    db.insert(schema.transactions)
      .values({
        id: "sony-financial-manual-sale",
        stockId: "corporate-action-sony-financial-8729",
        side: "sell",
        quantity: 2,
        price: 350,
        fee: 0,
        executedAt: "2025-10-01T12:00:00.000Z",
        decisionId: null,
        createdAt: "2025-10-01T12:00:00.000Z",
        priceCurrency: "JPY",
      })
      .run();
    expect(await portfolio.listPortfolioAction()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stockId: "corporate-action-sony-financial-8729",
          quantity: 3.5,
          averagePurchasePrice: 206,
        }),
      ]),
    );

    service.undoImport(batchId);
    expect(await portfolio.listPortfolioAction()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stockId: "corporate-action-sony-financial-8729",
          quantity: -2,
          hasWarning: true,
        }),
      ]),
    );
  });
});
