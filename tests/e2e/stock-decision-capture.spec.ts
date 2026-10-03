import { expect, test } from "@playwright/test";
import path from "node:path";
import type { Transaction } from "../../src/schemas/transaction";

test("records a decision for an imported trade without adding another trade", async ({
  page,
}) => {
  await page.goto("/more");
  await page
    .getByLabel("CSVを選択")
    .setInputFiles(
      path.join(process.cwd(), "tests/fixtures/csv-import/rakuten-jp.csv"),
    );
  await page.getByRole("button", { name: /件をインポート/ }).click();
  await expect(page.getByRole("status")).toHaveText(/件をインポートしました/);
  const before = await (await page.request.get("/api/export")).json();
  const trade: Transaction = before.transactions.find(
    (item: Transaction) => item.decisionId === null && item.side === "buy",
  );
  expect(trade).toBeTruthy();
  await page.route("**/api/decisions/extract", (route) =>
    route.fulfill({
      json: {
        type: "note",
        stock: { name: "別の抽出銘柄", ticker: null, market: null },
        summary: "過去の購入理由",
        points: [{ kind: "reason", text: "将来の需要を期待して購入", source: "raw_input" }],
        transaction: {
          side: "buy",
          quantity: 100,
          price: 1000,
          fee: null,
          executedAt: trade.executedAt,
        },
        followUpQuestion: null,
      },
    }),
  );
  await page.goto(`/stocks/${trade.stockId}?tab=trades`);
  await page
    .locator("li")
    .filter({ has: page.locator(`a[href$="transactionId=${trade.id}"]`) })
    .getByRole("link", { name: "このときの理由を残す" })
    .click();
  await page
    .getByLabel("いま考えていること")
    .fill("このとき将来の需要を期待して購入した。");
  await page.getByRole("button", { name: "内容を整理する" }).click();
  await expect(page.getByLabel("銘柄の登録先")).toHaveCount(0);
  await expect(page.getByLabel("記録の種類")).toHaveValue("buy");
  await expect(page.getByLabel("判断した日")).not.toHaveValue("");
  await expect(page.getByRole("group", { name: "関連する売買" })).toBeVisible();
  await expect(page.getByText("売買の事実も履歴に記録する")).toHaveCount(0);
  await page.getByRole("button", { name: "この内容で保存" }).click();
  await expect(page).toHaveURL(new RegExp(`/stocks/${trade.stockId}$`));
  await page.locator("summary", { hasText: "AIによる整理" }).click();
  await expect(page.getByText("過去の購入理由", { exact: true })).toBeVisible();
  await expect(page.getByText(/関連売買:/)).toBeVisible();
  const after = await (await page.request.get("/api/export")).json();
  expect(after.transactions).toHaveLength(before.transactions.length);
  const linked = after.transactions.find(
    (item: Transaction) => item.id === trade.id,
  );
  expect(linked.decisionId).toBeTruthy();
  await page.goto(`/stocks/${trade.stockId}?tab=trades`);
  await expect(
    page.locator(`a[href$="transactionId=${trade.id}"]`),
  ).toHaveCount(0);
  await expect(page.locator(`a[href$="#${linked.decisionId}"]`)).toBeVisible();
});

test("offers multiple matching trades, defaults a unique match, and preserves opting out", async ({
  page,
}) => {
  await page.route("**/api/decisions/extract", (route) =>
    route.fulfill({
      json: {
        type: "note",
        stock: { name: "架空候補確認社", ticker: null, market: null },
        summary: "候補確認の判断",
        points: [{ kind: "other", text: "候補確認の判断", source: "raw_input" }],
        transaction: null,
        followUpQuestion: null,
      },
    }),
  );
  await page.goto("/capture");
  await page
    .getByLabel("いま考えていること")
    .fill("架空候補確認社について記録する。");
  await page.getByRole("button", { name: "内容を整理する" }).click();
  await page.getByRole("button", { name: "この内容で保存" }).click();
  await expect(page).toHaveURL(/\/stocks\//);
  const stockUrl = page.url();
  await page.goto(`${stockUrl}?tab=trades`);
  const tradeForm = page
    .locator("form")
    .filter({ has: page.getByRole("heading", { name: "売買の事実を記録" }) });
  for (const day of ["2026-02-14", "2026-02-14", "2026-02-15"]) {
    await tradeForm.getByLabel("数量", { exact: true }).fill("10");
    await tradeForm.getByLabel("約定日").fill(day);
    await tradeForm.getByRole("button", { name: "売買履歴に追加" }).click();
    await expect(tradeForm.getByLabel("数量", { exact: true })).toHaveValue("");
  }
  await page.getByRole("link", { name: "考えを記録" }).click();
  await page
    .getByLabel("いま考えていること")
    .fill("過去の購入理由を記録する。");
  await page.getByRole("button", { name: "内容を整理する" }).click();
  await page.getByLabel("記録の種類").selectOption("buy");
  await page.getByLabel("判断した日").fill("2026-02-14");
  const selector = page.getByRole("group", { name: "関連する売買" });
  await expect(selector.getByRole("combobox")).toHaveValue("none");
  await expect(selector.getByRole("option")).toHaveCount(3);
  await page.getByLabel("判断した日").fill("2026-02-15");
  await expect(selector.getByRole("combobox")).not.toHaveValue("none");
  await selector.getByRole("combobox").selectOption("none");
  await page.getByLabel("要約").fill("紐付けない選択を維持する");
  await expect(selector.getByRole("combobox")).toHaveValue("none");
  await page.getByRole("button", { name: "この内容で保存" }).click();
  await expect(page).toHaveURL(stockUrl);
  const exported = await (await page.request.get("/api/export")).json();
  const stockId = stockUrl.split("/").pop();
  expect(
    exported.transactions
      .filter((trade: Transaction) => trade.stockId === stockId)
      .every((trade: Transaction) => trade.decisionId === null),
  ).toBe(true);
});
