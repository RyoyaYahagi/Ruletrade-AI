import { expect, test } from "@playwright/test";
import Database from "better-sqlite3";
import path from "node:path";

const databasePath = path.join(process.cwd(), ".data/e2e-test.sqlite");

test.afterEach(() => {
  // The E2E suite shares one database; leave no holding behind for the ratio tests.
  const database = new Database(databasePath);
  try {
    database.pragma("foreign_keys = ON");
    database.prepare("DELETE FROM stocks WHERE id LIKE 'bucket-stock-%'").run();
  } finally {
    database.close();
  }
});

test("changes a stock bucket and shows the change history", async ({
  page,
}) => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const stockId = `bucket-stock-${suffix}`;

  // Visit first so the app initializes the shared test database and schema.
  await page.goto("/");
  const database = new Database(databasePath);
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
  await expect(page.getByText("未分類", { exact: true })).toBeVisible();
  // The change form stays closed until the user asks for it.
  await expect(page.getByRole("radiogroup", { name: "区分" })).toHaveCount(0);
  await page.getByRole("button", { name: "変更", exact: true }).click();

  const save = page.getByRole("button", { name: "区分を保存" });
  await expect(save).toBeDisabled();
  await page.getByRole("radio", { name: "コア" }).click();
  await expect(
    page.getByText("「未分類」→「コア」に変更します。変更は履歴に残ります。"),
  ).toBeVisible();
  await page
    .getByPlaceholder("例: 買う前にコアと決めていた")
    .fill("買う前にコアと決めていた");
  await save.click();
  await expect(page.getByText("区分を「コア」に変更しました。")).toBeVisible();
  await expect(page.getByText("コア", { exact: true }).first()).toBeVisible();

  await page.getByText(/区分の変更履歴 1件 · 最後/).click();
  const history = page.locator("details").filter({
    hasText: "区分の変更履歴",
  });
  await expect(history.getByText("未分類 →")).toBeVisible();
  await expect(history.getByText("コア", { exact: true })).toBeVisible();
  await expect(history.getByText("買う前にコアと決めていた")).toBeVisible();
});

test("changes a bucket from the holdings row only after confirming", async ({
  page,
}) => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const stockId = `bucket-stock-row-${suffix}`;
  const name = `区分一覧社-${suffix}`;

  await page.goto("/");
  const database = new Database(databasePath);
  try {
    database
      .prepare(
        `INSERT INTO stocks (id, ticker, name, normalized_name, market, market_code, bucket, created_at)
         VALUES (?, '7203', ?, ?, 'JP', 'JP', 'core', ?)`,
      )
      .run(stockId, name, name, "2099-01-01T00:00:00.000Z");
    database
      .prepare(
        `INSERT INTO transactions (id, stock_id, side, quantity, price, fee, executed_at, decision_id, created_at, price_currency)
         VALUES (?, ?, 'buy', 10, 1000, NULL, ?, NULL, ?, 'JPY')`,
      )
      .run(
        `bucket-buy-${suffix}`,
        stockId,
        "2026-01-02T00:00:00.000Z",
        "2026-01-02T00:00:00.000Z",
      );
  } finally {
    database.close();
  }

  await page.goto("/portfolio");
  const row = page.getByRole("listitem").filter({ hasText: name });
  await row.getByRole("button", { name: new RegExp(name) }).click();
  await row.getByRole("radio", { name: "サテライト" }).click();
  await expect(
    row.getByText(
      "「コア」→「サテライト」に変更します。変更は履歴に残ります。",
    ),
  ).toBeVisible();

  // Cancelling keeps the saved bucket.
  await row.getByRole("button", { name: "やめる" }).click();
  await expect(row.getByRole("radio", { name: "コア" })).toHaveAttribute(
    "aria-checked",
    "true",
  );

  await row.getByRole("radio", { name: "サテライト" }).click();
  await row.getByRole("button", { name: "変更を保存" }).click();
  await expect(
    row.getByText(
      "区分を「サテライト」に変更しました。理由は銘柄詳細で残せます。",
    ),
  ).toBeVisible();
  await expect(row.getByRole("radio", { name: "サテライト" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});
