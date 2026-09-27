import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const directory = mkdtempSync(path.join(os.tmpdir(), "ruletrade-export-"));
process.env.RULETRADE_DATABASE_PATH = path.join(directory, "journal.sqlite");

describe("JSON export", () => {
  let database: typeof import("@/lib/db");
  let route: typeof import("@/app/api/export/route");
  let actions: typeof import("@/features/decisions/actions");

  beforeAll(async () => {
    database = await import("@/lib/db");
    route = await import("@/app/api/export/route");
    actions = await import("@/features/decisions/actions");
  });

  afterAll(() => {
    database.getDb().$client.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it("downloads an empty journal with format metadata", async () => {
    const response = await route.GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(response.headers.get("Content-Disposition")).toMatch(
      /^attachment; filename="ruletrade-.*\.json"$/,
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      formatVersion: 1,
      exportedAt: expect.any(String),
      stocks: [],
      decisions: [],
      transactions: [],
      reviews: [],
      importBatches: [],
      importBatchStocks: [],
      transactionImportSources: [],
      importChanges: [],
    });
  });

  it("preserves original text, nullable prices, list fields, and record references", async () => {
    const rawInput = "  日本語の原文\n変更しない。  ";
    const saved = await actions.saveDecisionAction({
      type: "buy",
      stock: { ticker: "285A", name: "キオクシア", market: "JP" },
      thesis: "需要を見守る",
      assumptions: ["需要が続く"],
      reviewConditions: ["需要の変化"],
      addConditions: [],
      followUpQuestion: null,
      rawInput,
      transcript: "編集前の音声原文",
      transaction: {
        side: "buy",
        quantity: 100,
        price: null,
        fee: null,
        executedAt: "2026-01-02T03:04:05.000Z",
      },
    });
    await actions.saveReviewAction({
      stockId: saved.stockId,
      decisionId: saved.decisionId,
      currentInput: "今の考え",
      summary: "比較結果",
      differences: ["前提が変わった"],
      reflection: "自分の振り返り",
    });

    const exported = await (await route.GET()).json();
    expect(exported.stocks).toHaveLength(1);
    expect(exported.decisions).toHaveLength(1);
    expect(exported.transactions).toHaveLength(1);
    expect(exported.reviews).toHaveLength(1);
    expect(exported.stocks[0]).toMatchObject({
      id: saved.stockId,
      name: "キオクシア",
    });
    expect(exported.decisions[0]).toMatchObject({
      id: saved.decisionId,
      stockId: saved.stockId,
      rawInput,
      transcript: "編集前の音声原文",
      assumptions: ["需要が続く"],
      reviewConditions: ["需要の変化"],
      addConditions: [],
    });
    expect(exported.transactions[0]).toMatchObject({
      stockId: saved.stockId,
      decisionId: saved.decisionId,
      quantity: 100,
      price: null,
      fee: null,
    });
    expect(exported.reviews[0]).toMatchObject({
      stockId: saved.stockId,
      decisionId: saved.decisionId,
      currentInput: "今の考え",
      differences: ["前提が変わった"],
      reflection: "自分の振り返り",
    });
  });

  it("exports the CSV source links and before/after changes for a merged manual trade", async () => {
    const { importCsv } = await import("@/features/csv-import/service");
    const csv = [
      "約定日,受渡日,銘柄コード,銘柄名,市場名称,口座区分,取引区分,売買区分,数量［株］,単価［円］,手数料［円］,受渡金額［円］",
      "2026/01/02,2026/01/05,285A,キオクシアホールディングス,東証,特定,現物,買付,100,1440,0,144000",
    ].join("\n");
    const { batchId, importedCount } = await importCsv(
      new TextEncoder().encode(csv),
      "merged.csv",
    );
    expect(importedCount).toBe(0);
    const exported = await (await route.GET()).json();
    expect(exported.transactionImportSources).toMatchObject([
      {
        transactionId: exported.transactions[0].id,
        importBatchId: batchId,
        sourceRowNumber: 2,
        sourceFingerprint: expect.any(String),
      },
    ]);
    expect(exported.importChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entity: "transaction",
          importBatchId: batchId,
        }),
        expect.objectContaining({ entity: "stock", importBatchId: batchId }),
      ]),
    );
    expect(exported.transactions[0].decisionId).toBe(exported.decisions[0].id);
    expect(exported.decisions[0].rawInput).toBe(
      "  日本語の原文\n変更しない。  ",
    );
  });

  it("returns an explicit error instead of a partial download when stored data is invalid", async () => {
    database
      .getDb()
      .$client.exec("UPDATE reviews SET differences_json = '[1]'");
    const response = await route.GET();
    expect(response.status).toBe(500);
    expect(response.headers.get("Content-Disposition")).toBeNull();
    expect(await response.json()).toEqual({
      error: expect.stringContaining("エクスポートできませんでした"),
    });
  });
});
