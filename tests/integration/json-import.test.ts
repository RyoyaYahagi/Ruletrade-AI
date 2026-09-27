import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const directory = mkdtempSync(path.join(os.tmpdir(), "ruletrade-json-import-"));
process.env.RULETRADE_DATABASE_PATH = path.join(directory, "journal.sqlite");

describe("JSON import", () => {
  let database: typeof import("@/lib/db");
  let exportRoute: typeof import("@/app/api/export/route");
  let importRoute: typeof import("@/app/api/import/json/route");
  let backup: Record<string, unknown>;

  const send = (value: unknown) =>
    importRoute.POST(
      new Request("http://localhost/api/import/json", {
        method: "POST",
        body: JSON.stringify(value),
      }),
    );
  const snapshot = async () => {
    const { exportedAt: _exportedAt, ...records } = await (
      await exportRoute.GET()
    ).json();
    expect(_exportedAt).toEqual(expect.any(String));
    return records;
  };

  beforeAll(async () => {
    database = await import("@/lib/db");
    exportRoute = await import("@/app/api/export/route");
    importRoute = await import("@/app/api/import/json/route");
    const { saveDecisionAction, editDecisionAction, saveReviewAction } =
      await import("@/features/decisions/actions");
    const { importCsv } = await import("@/features/csv-import/service");
    const saved = await saveDecisionAction({
      type: "buy",
      stock: { ticker: "285A", name: "キオクシア", market: "JP" },
      thesis: "需要を見守る",
      assumptions: ["需要が続く"],
      reviewConditions: [],
      addConditions: [],
      followUpQuestion: null,
      rawInput: "  日本語の原文\n変更しない。  ",
      transcript: "音声原文",
      transaction: {
        side: "buy",
        quantity: 100,
        price: null,
        fee: null,
        executedAt: "2026-01-02T03:04:05.000Z",
      },
    });
    await editDecisionAction({
      id: saved.decisionId,
      stockId: saved.stockId,
      type: "buy",
      rawInput: "更新した原文",
      thesis: "需要を見守る",
      assumptions: [],
      reviewConditions: [],
      addConditions: [],
      decidedAt: "2026-01-02",
      reviewDates: ["2026-10-01T00:00:00.000Z"],
      expectedRevision: 0,
    });
    await saveReviewAction({
      stockId: saved.stockId,
      decisionId: saved.decisionId,
      currentInput: "今の考え",
      summary: "比較結果",
      differences: ["前提が変わった"],
      reflection: "自分の振り返り",
    });
    await importCsv(
      new TextEncoder().encode(
        [
          "約定日,受渡日,銘柄コード,銘柄名,市場名称,口座区分,取引区分,売買区分,数量［株］,単価［円］,手数料［円］,受渡金額［円］",
          "2026/01/02,2026/01/05,285A,キオクシアホールディングス,東証,特定,現物,買付,100,1440,0,144000",
        ].join("\n"),
      ),
      "merged.csv",
    );
    backup = await (await exportRoute.GET()).json();
    database
      .getDb()
      .$client.exec(
        "DELETE FROM reviews; DELETE FROM import_changes; DELETE FROM transaction_import_sources; DELETE FROM transactions; DELETE FROM decisions; DELETE FROM import_batch_stocks; DELETE FROM import_batches; DELETE FROM stocks;",
      );
  });
  afterAll(() => {
    database.getDb().$client.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it("restores all exported records, original text, edit history and CSV undo history", async () => {
    const response = await send(backup);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      importedCount: expect.any(Number),
      skippedCount: 0,
    });
    const { exportedAt: _exportedAt, ...expected } = backup;
    expect(_exportedAt).toEqual(expect.any(String));
    expect(await snapshot()).toEqual(expected);
  });

  it("does not duplicate records when importing the same backup again", async () => {
    const before = await snapshot();
    const response = await send(backup);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      importedCount: 0,
      skippedCount: expect.any(Number),
    });
    expect(await snapshot()).toEqual(before);
  });

  it("rolls back newly inserted records when a later record conflicts", async () => {
    const before = await snapshot();
    const conflicting = structuredClone(backup);
    const stockRows = conflicting.stocks as Array<Record<string, unknown>>;
    stockRows.unshift({ ...stockRows[0], id: "new-stock" });
    const decisionRows = conflicting.decisions as Array<
      Record<string, unknown>
    >;
    decisionRows[0].rawInput = "上書きしない";
    expect((await send(conflicting)).status).toBe(400);
    expect(await snapshot()).toEqual(before);
  });

  it("rejects unknown versions, malformed data, missing references and repeated IDs without writing", async () => {
    const before = await snapshot();
    for (const value of [
      { ...backup, formatVersion: 2 },
      { ...backup, stocks: [] },
      {
        ...backup,
        stocks: [
          ...(backup.stocks as unknown[]),
          ...(backup.stocks as unknown[]),
        ],
      },
      { ...backup, decisions: [{ rawInput: 123 }] },
    ])
      expect((await send(value)).status).toBe(400);
    const response = await importRoute.POST(
      new Request("http://localhost/api/import/json", {
        method: "POST",
        body: "{",
      }),
    );
    expect(response.status).toBe(400);
    expect(await snapshot()).toEqual(before);
  });

  it("rejects unsafe fields in CSV undo history", async () => {
    const before = await snapshot();
    const invalid = structuredClone(backup);
    const changes = invalid.importChanges as Array<Record<string, unknown>>;
    changes[0].before = '{"id":"another-id"}';
    changes[0].after = '{"id":"another-id"}';
    expect((await send(invalid)).status).toBe(400);
    expect(await snapshot()).toEqual(before);
  });

  it("can undo a restored CSV batch while retaining the user's decision and manual trade", async () => {
    const { undoImport } = await import("@/features/csv-import/service");
    const batches = backup.importBatches as Array<{ id: string }>;
    undoImport(batches[0].id);
    const restored = await snapshot();
    expect(restored.decisions).toHaveLength(1);
    expect(restored.transactions).toMatchObject([{ price: null, fee: null }]);
    expect(restored.stocks).toMatchObject([{ name: "キオクシア" }]);
    expect(restored.reviews).toHaveLength(1);
  });
});
