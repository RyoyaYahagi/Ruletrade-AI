import { expect, test } from "@playwright/test";
import Database from "better-sqlite3";
import path from "node:path";

const databasePath = path.join(process.cwd(), ".data/e2e-test.sqlite");

test.afterEach(() => {
  const database = new Database(databasePath);
  try {
    database
      .prepare(
        "UPDATE app_settings SET satellite_cap_pct = NULL, satellite_warn_pct = NULL WHERE id = 'default'",
      )
      .run();
    database
      .prepare("DELETE FROM stocks WHERE id LIKE 'warning-stock-%'")
      .run();
  } finally {
    database.close();
  }
});

test("surfaces the bucket warning on the today screen and in the due API", async ({
  page,
}) => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const stockId = `warning-stock-${suffix}`;

  await page.goto("/");
  const database = new Database(databasePath);
  try {
    database
      .prepare(
        `INSERT INTO stocks (id, ticker, name, normalized_name, market, market_code, bucket, created_at)
         VALUES (?, ?, ?, ?, 'JP', 'JP', 'satellite', ?)`,
      )
      .run(
        stockId,
        "7203",
        `警告検証社-${suffix}`,
        `警告検証社-${suffix}`,
        "2099-01-01T00:00:00.000Z",
      );
    database
      .prepare(
        `INSERT INTO transactions (id, stock_id, side, quantity, price, fee, executed_at, decision_id, created_at, price_currency)
         VALUES (?, ?, 'buy', 10, 1000, NULL, ?, NULL, ?, 'JPY')`,
      )
      .run(
        `warning-buy-${suffix}`,
        stockId,
        "2026-01-02T00:00:00.000Z",
        "2026-01-02T00:00:00.000Z",
      );
    database
      .prepare(
        "UPDATE app_settings SET satellite_warn_pct = 40 WHERE id = 'default'",
      )
      .run();
  } finally {
    database.close();
  }

  await page.goto("/");
  const warning = page.locator(
    'section[aria-labelledby="bucket-warning-heading"]',
  );
  await expect(
    warning.getByRole("heading", {
      name: "サテライトの時価割合が警告線を超えています",
    }),
  ).toBeVisible();
  await expect(warning).toContainText("現在 100%");
  await expect(warning).toContainText("警告線 40%");
  await expect(
    warning.getByRole("link", { name: /ポートフォリオで確認/ }),
  ).toBeVisible();

  const dueResponse = await page.request.get("/api/integration/v1/due", {
    headers: { authorization: "Bearer e2e-read-token" },
  });
  expect(dueResponse.status()).toBe(200);
  const due = (await dueResponse.json()) as {
    data: {
      asOf: string;
      dueDecisions: unknown[];
      unlinkedTransactions: Array<{ transaction: { stockId: string } }>;
      bucketWarning: {
        warnPct: number;
        marketValuePct: number;
        marketValueJpy: number | null;
      } | null;
    };
  };
  expect(due.data.asOf).toEqual(expect.any(String));
  expect(due.data.dueDecisions).toEqual([]);
  expect(
    due.data.unlinkedTransactions.some(
      ({ transaction }) => transaction.stockId === stockId,
    ),
  ).toBe(true);
  expect(due.data.bucketWarning).toMatchObject({
    warnPct: 40,
    marketValuePct: 100,
    marketValueJpy: 10000,
  });

  // Exactly on the line is not an overage.
  const raised = new Database(databasePath);
  try {
    raised
      .prepare(
        "UPDATE app_settings SET satellite_warn_pct = 100 WHERE id = 'default'",
      )
      .run();
  } finally {
    raised.close();
  }

  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "サテライトの時価割合が警告線を超えています",
    }),
  ).toHaveCount(0);

  const clearedResponse = await page.request.get("/api/integration/v1/due", {
    headers: { authorization: "Bearer e2e-read-token" },
  });
  expect(clearedResponse.status()).toBe(200);
  const cleared = (await clearedResponse.json()) as {
    data: { bucketWarning: unknown };
  };
  expect(cleared.data.bucketWarning).toBeNull();
});
