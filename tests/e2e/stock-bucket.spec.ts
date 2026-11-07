import { expect, test } from "@playwright/test";
import Database from "better-sqlite3";
import path from "node:path";

test("changes a stock bucket and shows the change history", async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const stockId = `bucket-stock-${suffix}`;

  // Visit first so the app initializes the shared test database and schema.
  await page.goto("/");
  const database = new Database(
    path.join(process.cwd(), ".data/e2e-test.sqlite"),
  );
  try {
    database
      .prepare(
        `INSERT INTO stocks (id, ticker, name, normalized_name, market, market_code, created_at)
         VALUES (?, ?, ?, ?, 'JP', 'JP', ?)`,
      )
      .run(
        stockId,
        "7203",
        `区分検証社-${suffix}`,
        `区分検証社-${suffix}`,
        "2099-01-01T00:00:00.000Z",
      );
  } finally {
    database.close();
  }

  await page.goto(`/stocks/${stockId}`);
  await expect(page.getByRole("heading", { name: "区分", exact: true })).toBeVisible();
  await expect(page.getByText("現在: 未分類")).toBeVisible();
  await page.locator("select").selectOption("core");
  await page
    .getByPlaceholder("例: 買う前にコアと決めていた")
    .fill("買う前にコアと決めていた");
  await page.getByRole("button", { name: "区分を保存" }).click();
  await expect(
    page.getByText("区分を「コア」に変更しました。"),
  ).toBeVisible();
  await expect(page.getByText("現在: コア")).toBeVisible();

  await page.getByText("区分の変更履歴（1件）").click();
  const history = page.locator("details").filter({
    hasText: "区分の変更履歴",
  });
  await expect(history.getByText("未分類 →")).toBeVisible();
  await expect(history.getByText("コア", { exact: true })).toBeVisible();
  await expect(
    history.getByText("理由: 買う前にコアと決めていた"),
  ).toBeVisible();
});
