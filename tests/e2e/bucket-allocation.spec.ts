import { expect, test } from "@playwright/test";
import Database from "better-sqlite3";
import path from "node:path";

const databasePath = path.join(process.cwd(), ".data/e2e-test.sqlite");

test.afterEach(() => {
  // The E2E suite shares one database; leave no bucket fixture behind.
  const database = new Database(databasePath);
  try {
    // Without this pragma the delete below would leave orphaned transactions.
    database.pragma("foreign_keys = ON");
    database
      .prepare(
        "UPDATE app_settings SET satellite_cap_pct = NULL, satellite_warn_pct = NULL WHERE id = 'default'",
      )
      .run();
    database
      .prepare("DELETE FROM stocks WHERE id LIKE 'allocation-stock-%'")
      .run();
  } finally {
    database.close();
  }
});

test("shows the bucket ratio, remaining cap and warning on the portfolio", async ({
  page,
}) => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const stockId = `allocation-stock-${suffix}`;
  const coreStockId = `allocation-stock-core-${suffix}`;

  // Visit first so the app initializes the shared test database and schema.
  await page.goto("/");
  const database = new Database(databasePath);
  try {
    const insertStock = database.prepare(
      `INSERT INTO stocks (id, ticker, name, normalized_name, market, market_code, bucket, created_at)
       VALUES (?, ?, ?, ?, 'JP', 'JP', ?, ?)`,
    );
    const insertBuy = database.prepare(
      `INSERT INTO transactions (id, stock_id, side, quantity, price, fee, executed_at, decision_id, created_at, price_currency)
       VALUES (?, ?, 'buy', 10, 1000, NULL, ?, NULL, ?, 'JPY')`,
    );
    for (const [id, ticker, bucket] of [
      [stockId, "7203", "satellite"],
      [coreStockId, "1306", "core"],
    ] as const) {
      insertStock.run(
        id,
        ticker,
        `配分検証社-${bucket}-${suffix}`,
        `配分検証社-${bucket}-${suffix}`,
        bucket,
        "2099-01-01T00:00:00.000Z",
      );
      insertBuy.run(
        `allocation-buy-${bucket}-${suffix}`,
        id,
        "2026-01-02T00:00:00.000Z",
        "2026-01-02T00:00:00.000Z",
      );
    }
    database
      .prepare(
        "UPDATE app_settings SET satellite_cap_pct = 20, satellite_warn_pct = 40 WHERE id = 'default'",
      )
      .run();
  } finally {
    database.close();
  }

  await page.goto("/portfolio");
  const panel = page.locator(
    'section[aria-labelledby="bucket-allocation-heading"]',
  );
  await expect(
    panel.getByRole("heading", { name: "コア／サテライト" }),
  ).toBeVisible();
  // Invested 10,000円 satellite + 10,000円 core; a 20% cap is 4,000円.
  await expect(panel.getByText("上限を超えている額")).toBeVisible();
  await expect(panel.getByText("6,000円", { exact: true })).toBeVisible();
  await expect(
    panel.getByText("上限 20%（4,000円）に対して現在 50%"),
  ).toBeVisible();
  await expect(panel.getByText("警告線を超えています")).toBeVisible();

  // The existing currency-by-currency holdings section remains.
  await expect(page.getByRole("heading", { name: "保有銘柄" })).toBeVisible();
  await expect(
    page.getByText(`配分検証社-satellite-${suffix}`).first(),
  ).toBeVisible();

  // The settings form previews the remaining amount before saving.
  await page.goto("/more");
  await page.getByLabel("サテライトの上限").fill("100");
  await expect(
    page.getByText("この上限だと、サテライトに足せる残りは", { exact: false }),
  ).toContainText("10,000円");
  await page.getByRole("button", { name: "枠の設定を保存" }).click();
  await expect(page.getByText("枠の設定を保存しました。")).toBeVisible();

  await page.goto("/portfolio");
  const updated = page.locator(
    'section[aria-labelledby="bucket-allocation-heading"]',
  );
  await expect(updated.getByText("サテライトに足せる残り")).toBeVisible();
  await expect(
    updated.getByText("上限 100%（20,000円）まで · 現在 50%"),
  ).toBeVisible();
  await expect(updated.getByText("上限を超えている額")).toHaveCount(0);
});
