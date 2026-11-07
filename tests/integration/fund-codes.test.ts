import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";

const directory = mkdtempSync(path.join(os.tmpdir(), "ruletrade-fund-codes-"));
const timestamp = "2026-02-13T15:00:00.000Z";

let database: typeof import("@/lib/db");
let schema: typeof import("@/lib/db/schema");
let actions: typeof import("@/features/stocks/actions");
let exportRoute: typeof import("@/app/api/export/route");
let importRoute: typeof import("@/app/api/import/json/route");

beforeAll(async () => {
  process.env.RULETRADE_DATABASE_PATH = path.join(directory, "journal.sqlite");
  database = await import("@/lib/db");
  schema = await import("@/lib/db/schema");
  actions = await import("@/features/stocks/actions");
  exportRoute = await import("@/app/api/export/route");
  importRoute = await import("@/app/api/import/json/route");
  database
    .getDb()
    .insert(schema.stocks)
    .values({
      id: "fund-1",
      ticker: null,
      name: "架空インデックスファンド",
      normalizedName: "架空インデックスファンド",
      market: "JP",
      marketCode: "JP",
      createdAt: timestamp,
    })
    .run();
});

afterAll(() => {
  database.getDb().$client.close();
  rmSync(directory, { recursive: true, force: true });
});

it("saves normalized fund codes and clears them together", async () => {
  expect(
    await actions.setStockFundCodesAction({
      stockId: "fund-1",
      fundIsin: " jp90c000gkc6 ",
      fundAssociationCode: "03311187",
    }),
  ).toEqual({
    ok: true,
    fundIsin: "JP90C000GKC6",
    fundAssociationCode: "03311187",
  });
  const exported = await (await exportRoute.GET()).json();
  expect(exported.stocks[0]).toMatchObject({
    fundIsin: "JP90C000GKC6",
    fundAssociationCode: "03311187",
  });

  database.getDb().$client.exec("DELETE FROM stocks;");
  const restored = await importRoute.POST(
    new Request("http://localhost/api/import/json", {
      method: "POST",
      body: JSON.stringify(exported),
    }),
  );
  expect(restored.status).toBe(200);
  expect((await (await exportRoute.GET()).json()).stocks).toEqual(
    exported.stocks,
  );

  expect(
    await actions.setStockFundCodesAction({
      stockId: "fund-1",
      fundIsin: "",
      fundAssociationCode: "",
    }),
  ).toEqual({ ok: true, fundIsin: null, fundAssociationCode: null });
});

it("rejects partial or malformed codes and unknown stocks without writing", async () => {
  for (const input of [
    { stockId: "fund-1", fundIsin: "JP90C000GKC6", fundAssociationCode: "" },
    {
      stockId: "fund-1",
      fundIsin: "US0000000000",
      fundAssociationCode: "03311187",
    },
    {
      stockId: "missing",
      fundIsin: "JP90C000GKC6",
      fundAssociationCode: "03311187",
    },
  ]) {
    expect(await actions.setStockFundCodesAction(input)).toMatchObject({
      ok: false,
    });
  }
  expect(database.getDb().select().from(schema.stocks).all()[0]).toMatchObject({
    fundIsin: null,
    fundAssociationCode: null,
  });
});
