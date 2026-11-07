import { expect, test } from "@playwright/test";
import Database from "better-sqlite3";
import path from "node:path";

const databasePath = path.join(process.cwd(), ".data/e2e-test.sqlite");

test.afterEach(() => {
  // The E2E suite shares one database; leave no bucket fixture behind.
  const database = new Database(databasePath);
  try {
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

  // Visit first so the app initializes the shared test database and schema.
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
        `配分検証社-${suffix}`,
        `配分検証社-${suffix}`,
        "2099-01-01T00:00:00.000Z",
      );
    database
      .prepare(
        `INSERT INTO transactions (id, stock_id, side, quantity, price, fee, executed_at, decision_id, created_at, price_currency)
         VALUES (?, ?, 'buy', 10, 1000, NULL, ?, NULL, ?, 'JPY')`,
      )
      .run(
        `allocation-buy-${suffix}`,
        stockId,
        "2026-01-02T00:00:00.000Z",
        "2026-01-02T00:00:00.000Z",
      );
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
  await expect(panel.getByText("サテライト割合（投入額ベース）")).toBeVisible();
  await expect(panel.getByText("100%", { exact: true }).first()).toBeVisible();
  await expect(panel.getByText("上限 20%")).toBeVisible();
  await expect(panel.getByText("8,000円 超過しています")).toBeVisible();
  await expect(
    panel.getByText("警告線 40% を超えています", { exact: false }),
  ).toBeVisible();
  await expect(
    panel.getByText(
      "コア未登録のため、割合はサテライトのみで計算されています。",
    ),
  ).toBeVisible();

  // The existing currency-by-currency holdings section remains.
  await expect(page.getByRole("heading", { name: "保有銘柄" })).toBeVisible();
  await expect(page.getByText(`配分検証社-${suffix}`).first()).toBeVisible();

  // A settings change is reflected on the next portfolio render.
  await page.goto("/more");
  await page.getByLabel("サテライト上限（投入額ベース・％）").fill("100");
  await page.getByRole("button", { name: "枠の設定を保存" }).click();
  await expect(page.getByText("枠の設定を保存しました。")).toBeVisible();

  await page.goto("/portfolio");
  await expect(
    page
      .locator('section[aria-labelledby="bucket-allocation-heading"]')
      .getByText("上限 100%"),
  ).toBeVisible();
  await expect(page.getByText("8,000円 超過しています")).toHaveCount(0);
});
