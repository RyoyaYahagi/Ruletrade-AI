import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("imports JSON beside export, skips duplicates and reports invalid files", async ({
  page,
}) => {
  const stockId = randomUUID();
  const backup = {
    formatVersion: 1,
    exportedAt: "2026-09-27T00:00:00.000Z",
    stocks: [
      {
        id: stockId,
        ticker: null,
        name: "JSON復元銘柄",
        normalizedName: "json復元銘柄",
        market: null,
        marketCode: null,
        createdAt: "2026-09-27T00:00:00.000Z",
      },
    ],
    decisions: [],
    transactions: [],
    reviews: [],
    importBatches: [],
    importBatchStocks: [],
    transactionImportSources: [],
    importChanges: [],
  };
  const upload = {
    name: "journal.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  };
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/more");
  const button = page.getByRole("button", {
    name: "JSONをインポート",
    exact: true,
  });
  const section = page
    .locator("section")
    .filter({ has: page.getByRole("link", { name: "JSONをエクスポート" }) });
  await expect(
    section.getByRole("button", { name: "JSONをインポート" }),
  ).toBeVisible();
  await expect(button).toBeDisabled();
  await page.getByLabel("JSONファイル", { exact: true }).setInputFiles(upload);
  await button.click();
  await expect(page.getByRole("status")).toHaveText(
    "1件の記録を取り込みました。同じ内容の記録0件は追加しませんでした。",
  );
  const exported = await (await page.request.get("/api/export")).json();
  expect(
    exported.stocks.filter((stock: { id: string }) => stock.id === stockId),
  ).toHaveLength(1);
  await expect(button).toBeDisabled();
  await page.getByLabel("JSONファイル", { exact: true }).setInputFiles(upload);
  await button.click();
  await expect(page.getByRole("status")).toHaveText(
    "0件の記録を取り込みました。同じ内容の記録1件は追加しませんでした。",
  );
  await page.getByLabel("JSONファイル", { exact: true }).setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from("{"),
  });
  await button.click();
  await expect(section.getByRole("alert")).toHaveText(
    "JSONファイルを読み込めませんでした。ファイルの内容を確認してください。",
  );
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
});
