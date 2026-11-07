import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const directory = mkdtempSync(path.join(os.tmpdir(), "ruletrade-r02-backup-"));
process.env.RULETRADE_DATABASE_PATH = path.join(directory, "journal.sqlite");
const timestamp = "2026-02-13T15:00:00.000Z";

describe("captures and origins in JSON backups", () => {
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
  const clear = () =>
    database
      .getDb()
      .$client.exec(
        "DELETE FROM captures; DELETE FROM reviews; DELETE FROM import_changes; DELETE FROM transaction_import_sources; DELETE FROM transactions; DELETE FROM decisions; DELETE FROM import_batch_stocks; DELETE FROM import_batches; DELETE FROM stocks;",
      );

  beforeAll(async () => {
    database = await import("@/lib/db");
    exportRoute = await import("@/app/api/export/route");
    importRoute = await import("@/app/api/import/json/route");
    const { saveDecisionAction, saveReviewAction } =
      await import("@/features/decisions/actions");
    const saved = await saveDecisionAction({
      type: "buy",
      stock: { ticker: "285A", name: "キオクシア", market: "JP" },
      thesis: "需要を見守る",
      assumptions: [],
      reviewConditions: [],
      addConditions: [],
      followUpQuestion: null,
      transaction: null,
      rawInput: "Muse から書き戻した判断",
      transcript: null,
    });
    await saveReviewAction({
      stockId: saved.stockId,
      decisionId: saved.decisionId,
      currentInput: "今の考え",
      summary: "比較結果",
      differences: ["前提が変わった"],
      reflection: "自分の振り返り",
    });
    const client = database.getDb().$client;
    client
      .prepare("UPDATE decisions SET origin = 'muse' WHERE id = ?")
      .run(saved.decisionId);
    client
      .prepare("UPDATE reviews SET origin = 'muse' WHERE stock_id = ?")
      .run(saved.stockId);
    client
      .prepare(
        "INSERT INTO captures (id, stock_id, stock_hint, raw_input, origin, status, decision_id, created_at, organized_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        "capture-web",
        null,
        "キオクシア",
        "銘柄未定の原文",
        "web",
        "pending",
        null,
        timestamp,
        null,
      );
    client
      .prepare(
        "INSERT INTO captures (id, stock_id, stock_hint, raw_input, origin, status, decision_id, created_at, organized_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        "capture-muse",
        saved.stockId,
        null,
        "整理済みの原文",
        "muse",
        "organized",
        saved.decisionId,
        timestamp,
        timestamp,
      );
    backup = await (await exportRoute.GET()).json();
  });
  afterAll(() => {
    database.getDb().$client.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it("exports captures and the origins of decisions and reviews", async () => {
    expect(backup.formatVersion).toBe(4);
    expect(backup.decisions).toMatchObject([{ origin: "muse" }]);
    expect(backup.reviews).toMatchObject([{ origin: "muse" }]);
    expect(backup.captures).toEqual([
      {
        id: "capture-muse",
        stockId: expect.any(String),
        stockHint: null,
        rawInput: "整理済みの原文",
        origin: "muse",
        status: "organized",
        decisionId: expect.any(String),
        createdAt: timestamp,
        organizedAt: timestamp,
      },
      {
        id: "capture-web",
        stockId: null,
        stockHint: "キオクシア",
        rawInput: "銘柄未定の原文",
        origin: "web",
        status: "pending",
        decisionId: null,
        createdAt: timestamp,
        organizedAt: null,
      },
    ]);
  });

  it("round-trips captures and origins through export and import", async () => {
    clear();
    expect((await send(backup)).status).toBe(200);
    expect(await snapshot()).toEqual(
      Object.fromEntries(
        Object.entries(backup).filter(([key]) => key !== "exportedAt"),
      ),
    );
  });

  it("imports a formatVersion 2 backup without captures or origins", async () => {
    clear();
    const v2 = structuredClone(backup);
    v2.formatVersion = 2;
    delete v2.captures;
    for (const decision of v2.decisions as Array<Record<string, unknown>>) {
      delete decision.origin;
      for (const edit of (decision.editHistory ?? []) as Array<
        Record<string, unknown>
      >) {
        delete (edit.previous as Record<string, unknown>).origin;
      }
    }
    for (const review of v2.reviews as Array<Record<string, unknown>>)
      delete review.origin;
    expect((await send(v2)).status).toBe(200);
    const exported = await snapshot();
    expect(exported.formatVersion).toBe(4);
    expect(exported.captures).toEqual([]);
    expect(exported.decisions).toMatchObject([{ origin: "web" }]);
    expect(exported.reviews).toMatchObject([{ origin: "web" }]);
  });

  it("rejects pending captures with a decision or organization timestamp without writing", async () => {
    const before = await snapshot();
    for (const field of ["decisionId", "organizedAt"]) {
      const invalid = structuredClone(backup);
      const captures = invalid.captures as Array<Record<string, unknown>>;
      captures[0].status = "pending";
      captures[0][field === "decisionId" ? "organizedAt" : "decisionId"] = null;
      expect((await send(invalid)).status).toBe(400);
      expect(await snapshot()).toEqual(before);
    }
  });

  it("rejects captures that reference records missing from the backup", async () => {
    const before = await snapshot();
    const invalid = structuredClone(backup);
    const captures = invalid.captures as Array<Record<string, unknown>>;
    captures[0].decisionId = "missing-decision";
    expect((await send(invalid)).status).toBe(400);
    expect(await snapshot()).toEqual(before);
  });
});
