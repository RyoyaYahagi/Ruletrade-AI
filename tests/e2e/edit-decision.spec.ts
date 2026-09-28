import { expect, test } from "@playwright/test";

test("edits a decision without losing the trade or original content and can cancel an edit", async ({
  page,
}) => {
  await page.route("**/api/decisions/extract", (route) =>
    route.fulfill({
      json: {
        type: "buy",
        stock: { name: "架空編集確認社", ticker: null, market: null },
        summary: "編集前の投資仮説",
        points: [{ kind: "expectation", text: "編集前の条件", source: "raw_input" }],
        followUpQuestion: null,
        transaction: {
          side: "buy",
          quantity: 10,
          price: 1000,
          fee: null,
          executedAt: "2026-01-01T12:00:00.000Z",
        },
      },
    }),
  );
  await page.goto("/");
  await page.getByLabel("テキストで入力する").fill("編集前の原文を残す。");
  await page.getByRole("button", { name: "内容を整理する" }).click();
  await page.getByRole("button", { name: "日付指定", exact: true }).click();
  await page.getByLabel("振り返り日", { exact: true }).fill("2099-01-01");
  await page.getByRole("button", { name: "この内容で保存" }).click();
  await expect(page).toHaveURL(/\/stocks\//);
  const stockId = page.url().split("/").pop();
  const before = await (await page.request.get("/api/export")).json();
  const original = before.decisions.find(
    (item: { stockId: string }) => item.stockId === stockId,
  );
  await page.getByRole("link", { name: "編集", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "判断を編集", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("判断の本文")).toHaveValue(
    "編集前の原文を残す。",
  );
  await page.getByLabel("判断の本文").fill("原文の誤記を修正した。");
  await page
    .getByRole("textbox", { name: "要約", exact: true })
    .fill("編集後の投資仮説");
  await page.getByLabel("記録の種類").selectOption("add");
  await page.getByLabel("判断した日").fill("2026-01-02");
    await page.getByLabel("整理した点 1", { exact: true }).fill("需要が鈍ったら考えを見直す");
  await page.getByRole("button", { name: "振り返り日を追加" }).click();
  await page
    .getByLabel("追加の振り返り日 1", { exact: true })
    .fill("2099-02-01");
  await page.getByRole("button", { name: "変更を保存" }).click();
  await expect(page.getByText("編集後の投資仮説", { exact: true })).toBeVisible();
  await expect(page.getByText("需要が鈍ったら考えを見直す", { exact: true })).toBeVisible();
  await expect(page.getByText(/関連売買:/)).toBeVisible();
  await page.getByText("編集履歴（1件）", { exact: true }).click();
  await expect(
    page.getByText("編集前の原文を残す。", { exact: true }),
  ).toBeVisible();
  const after = await (await page.request.get("/api/export")).json();
  const edited = after.decisions.find(
    (item: { id: string }) => item.id === original.id,
  );
  expect(edited.createdAt).toBe(original.createdAt);
  expect(edited.summary).toBe("編集後の投資仮説");
  expect(edited.points).toEqual([{ kind: "expectation", text: "需要が鈍ったら考えを見直す", source: "raw_input" }]);
  expect(edited.reviewDates).toHaveLength(2);
  expect(after.transactions).toEqual(before.transactions);
  expect(after.decisions).toHaveLength(before.decisions.length);
  await page.getByRole("link", { name: "編集", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "判断を編集", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "要約", exact: true })
    .fill("保存しない変更");
  await page.getByRole("link", { name: "キャンセル", exact: true }).click();
  await expect(
    page.getByText("編集後の投資仮説", { exact: true }),
  ).toBeVisible();
  expect(
    await (await page.request.get("/api/export"))
      .json()
      .then((data) =>
        data.decisions.find((item: { id: string }) => item.id === original.id),
      ),
  ).toEqual(edited);
});
