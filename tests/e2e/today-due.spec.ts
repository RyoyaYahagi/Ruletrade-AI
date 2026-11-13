import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

function jstDate(offsetDays: number): string {
  const shifted =
    Date.now() + 9 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000;
  return new Date(shifted).toISOString().slice(0, 10);
}

async function captureDecision(page: Page, name: string, reviewDate: string) {
  await page.goto("/capture/structured");
  await page.getByLabel("いま考えていること").fill(`${name}の判断メモ。`);
  await page.getByLabel("銘柄名").fill(name);
  await page
    .getByLabel("証券コード（任意）")
    .fill(`E2E-${randomUUID().slice(0, 8)}`);
  await page.getByLabel("要約（任意）").fill(`${name}の判断`);
  await page.getByRole("button", { name: "日付指定" }).click();
  await page.getByLabel("振り返り日").fill(reviewDate);
  await page.getByRole("button", { name: "この内容で保存" }).click();
  await expect(page).toHaveURL(/\/stocks\//);
}

test("今日画面 shows due decisions and unlinked trades from the same data as the API rule", async ({
  page,
}) => {
  const suffix = randomUUID().slice(0, 8);
  const olderName = `期限超過社${suffix}`;
  const recentName = `期限直前社${suffix}`;
  const futureName = `期限未来社${suffix}`;
  const unlinkedStockName = `理由待ち社${suffix}`;
  const unlinkedStockId = randomUUID();
  const transactionId = randomUUID();

  await captureDecision(page, olderName, jstDate(-5));
  await captureDecision(page, recentName, jstDate(-1));
  await captureDecision(page, futureName, jstDate(30));

  const backup = {
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    stocks: [
      {
        id: unlinkedStockId,
        ticker: `U-${suffix}`,
        name: unlinkedStockName,
        normalizedName: unlinkedStockName,
        market: "JP",
        marketCode: "JP",
        createdAt: new Date().toISOString(),
      },
    ],
    decisions: [],
    transactions: [
      {
        id: transactionId,
        stockId: unlinkedStockId,
        side: "buy",
        quantity: 100,
        price: 1200,
        fee: null,
        executedAt: jstDate(-2) + "T12:00:00.000Z",
        decisionId: null,
        createdAt: new Date().toISOString(),
        priceCurrency: "JPY",
        feeCurrency: null,
        settlementDate: null,
        settlementCurrency: null,
        settlementAmount: null,
        exchangeRate: null,
        accountType: "特定",
        sourceBroker: null,
        sourceTradeType: null,
      },
    ],
    reviews: [],
    importBatches: [],
    importBatchStocks: [],
    transactionImportSources: [],
    importChanges: [],
  };
  await page.goto("/more");
  await page.getByLabel("JSONファイル", { exact: true }).setInputFiles({
    name: "today-due.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page
    .getByRole("button", { name: "JSONをインポート", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("取り込みました");

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /振り返りの時期です/ }),
  ).toBeVisible();
  const dueSection = page.locator('section[aria-labelledby="due-heading"]');
  await expect(
    dueSection.getByRole("link", { name: new RegExp(olderName) }),
  ).toBeVisible();
  await expect(
    dueSection.getByRole("link", { name: new RegExp(recentName) }),
  ).toBeVisible();
  await expect(dueSection.getByText(futureName)).toHaveCount(0);

  const dueTexts = await dueSection.locator("article").allTextContents();
  const olderIndex = dueTexts.findIndex((text) => text.includes(olderName));
  const recentIndex = dueTexts.findIndex((text) => text.includes(recentName));
  expect(olderIndex).toBeGreaterThanOrEqual(0);
  expect(recentIndex).toBeGreaterThan(olderIndex);

  const unlinkedSection = page.locator(
    'section[aria-labelledby="unlinked-heading"]',
  );
  const unlinkedItem = unlinkedSection
    .locator("li")
    .filter({ hasText: unlinkedStockName });
  await expect(unlinkedItem).toBeVisible();
  await expect(unlinkedItem.getByText("購入 100株")).toBeVisible();
  await expect(
    unlinkedItem.getByRole("link", { name: "理由を残す" }),
  ).toHaveAttribute(
    "href",
    `/stocks/${unlinkedStockId}/capture?transactionId=${transactionId}`,
  );
});
