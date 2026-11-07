import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

const directory = mkdtempSync(path.join(os.tmpdir(), "ruletrade-cs03-"));
process.env.RULETRADE_DATABASE_PATH = path.join(directory, "journal.sqlite");

let database: typeof import("@/lib/db");
let settings: typeof import("@/features/settings/settings");
let exportRoute: typeof import("@/app/api/export/route");
let importRoute: typeof import("@/app/api/import/json/route");

beforeAll(async () => {
  database = await import("@/lib/db");
  settings = await import("@/features/settings/settings");
  exportRoute = await import("@/app/api/export/route");
  importRoute = await import("@/app/api/import/json/route");
});

afterAll(() => {
  database.getDb().$client.close();
  rmSync(directory, { recursive: true, force: true });
});

it("starts unset and stores both percentages", () => {
  expect(settings.getAppSettings()).toEqual({
    id: "default",
    satelliteCapPct: null,
    satelliteWarnPct: null,
    updatedAt: expect.any(String),
  });

  vi.useFakeTimers();
  try {
    vi.setSystemTime("2026-03-01T00:00:00.000Z");
    expect(
      settings.saveAppSettings({
        satelliteCapPct: 20,
        satelliteWarnPct: 40.5,
      }),
    ).toEqual({
      id: "default",
      satelliteCapPct: 20,
      satelliteWarnPct: 40.5,
      updatedAt: "2026-03-01T00:00:00.000Z",
    });
  } finally {
    vi.useRealTimers();
  }
  expect(settings.getAppSettings()).toEqual({
    id: "default",
    satelliteCapPct: 20,
    satelliteWarnPct: 40.5,
    updatedAt: "2026-03-01T00:00:00.000Z",
  });
});

it("can clear each setting back to null and rejects out-of-range values", () => {
  expect(
    settings.saveAppSettings({
      satelliteCapPct: null,
      satelliteWarnPct: null,
    }),
  ).toMatchObject({ satelliteCapPct: null, satelliteWarnPct: null });

  expect(() =>
    settings.saveAppSettings({
      satelliteCapPct: 101,
      satelliteWarnPct: -1,
    }),
  ).toThrow();
  expect(settings.getAppSettings()).toMatchObject({
    satelliteCapPct: null,
    satelliteWarnPct: null,
  });
});

it("includes settings in the export and restores them on import", async () => {
  settings.saveAppSettings({ satelliteCapPct: 25, satelliteWarnPct: 45 });
  const exported = await (await exportRoute.GET()).json();
  expect(exported.formatVersion).toBe(4);
  expect(exported.appSettings).toEqual({
    id: "default",
    satelliteCapPct: 25,
    satelliteWarnPct: 45,
    updatedAt: expect.any(String),
  });

  settings.saveAppSettings({ satelliteCapPct: null, satelliteWarnPct: null });
  const response = await importRoute.POST(
    new Request("http://localhost/api/import/json", {
      method: "POST",
      body: JSON.stringify(exported),
    }),
  );
  expect(response.status).toBe(200);
  expect(settings.getAppSettings()).toEqual(exported.appSettings);
});

it("leaves settings untouched when an older backup has none", async () => {
  settings.saveAppSettings({ satelliteCapPct: 30, satelliteWarnPct: 50 });
  const latest = await (await exportRoute.GET()).json();
  const legacy = structuredClone(latest) as Record<string, unknown>;
  legacy.formatVersion = 3;
  delete legacy.appSettings;
  const response = await importRoute.POST(
    new Request("http://localhost/api/import/json", {
      method: "POST",
      body: JSON.stringify(legacy),
    }),
  );
  expect(response.status).toBe(200);
  expect(settings.getAppSettings()).toMatchObject({
    satelliteCapPct: 30,
    satelliteWarnPct: 50,
  });
});
