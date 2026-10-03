import { expect, test } from "@playwright/test";

test("edits the summary and individual points before saving multiple review dates", async ({ page }) => {
  await page.route("**/api/decisions/extract", (route) => route.fulfill({
    json: {
      type: "note",
      stock: { name: "架空複数予定社", ticker: null, market: null },
      summary: "需要を継続して観察する。",
      points: [
        { kind: "expectation", text: "需要が続くと期待", source: "raw_input" },
        { kind: "condition", text: "条件を確認する", source: "raw_input" },
      ],
      transaction: null,
      followUpQuestion: null,
      factContext: { currentPosition: null, linkedTransaction: null },
    },
  }));
  await page.goto("/capture");
  await page.getByLabel("いま考えていること").fill("需要を継続して観察したい。");
  await page.getByRole("button", { name: "内容を整理する" }).click();
  await page.getByLabel("要約").fill("需要を毎月確認する。");
  await page.getByLabel("整理した点 1", { exact: true }).fill("需要が継続すると期待");
  await page.getByRole("button", { name: "整理した点 2 を削除" }).click();
  await page.getByRole("button", { name: "点を追加" }).click();
  await page.getByLabel("整理した点 2", { exact: true }).fill("次の決算を確認したい");

  await page.getByRole("button", { name: "1か月後", exact: true }).click();
  await page.getByRole("button", { name: "3か月後", exact: true }).click();
  await expect(page.getByRole("button", { name: "1か月後", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "3か月後", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "日付指定", exact: true }).click();
  await page.getByRole("button", { name: "この内容で保存" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("振り返り日を入力してください。");
  await page.getByLabel("振り返り日", { exact: true }).fill("2025-01-01");
  await page.getByRole("button", { name: "振り返り日を追加" }).click();
  await page.getByLabel("追加の振り返り日 1", { exact: true }).fill("2025-02-01");
  await page.getByRole("button", { name: "振り返り日を追加" }).click();
  await page.getByRole("button", { name: "追加の振り返り日 2を削除", exact: true }).click();
  await page.getByRole("button", { name: "次の決算", exact: true }).click();
  await page.getByLabel("次の決算日").fill("2025-03-01");
  await page.getByRole("button", { name: "この内容で保存" }).click();
  await expect(page).toHaveURL(/\/stocks\//);
  const stockId = page.url().split("/").pop();
  const exported = await (await page.request.get("/api/export")).json();
  const decision = exported.decisions.find((item: { stockId: string }) => item.stockId === stockId);
  expect(decision.summary).toBe("需要を毎月確認する。");
  expect(decision.points).toEqual([
    { kind: "expectation", text: "需要が継続すると期待", source: "raw_input" },
    { kind: "other", text: "次の決算を確認したい", source: "raw_input" },
  ]);
  expect(decision.reviewDates).toHaveLength(5);
  await expect(page.getByText(/振り返り予定:/)).toContainText("2025/1/1");
});
