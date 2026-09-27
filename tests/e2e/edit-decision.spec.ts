import { expect, test } from "@playwright/test";

test("edits a decision without losing the trade or original content and can cancel an edit", async ({
  page,
}) => {
  await page.route("**/api/decisions/extract", (route) =>
    route.fulfill({
      json: {
        type: "buy",
        stock: { name: "架空編集確認社", ticker: null, market: null },
        thesis: "編集前の投資仮説",
        assumptions: [],
        reviewConditions: ["編集前の条件"],
        addConditions: [],
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
    .getByRole("textbox", { name: "投資仮説", exact: true })
    .fill("編集後の投資仮説");
  await page.getByLabel("記録の種類").selectOption("add");
  await page.getByLabel("判断した日").fill("2026-01-02");
  const conditions = page.getByLabel("見直し条件（1行に1つ）");
  await conditions.fill("需要が鈍ったら");
  await conditions.press("End");
  await conditions.press("Enter");
  await expect(conditions).toHaveValue("需要が鈍ったら\n");
  await conditions.pressSequentially("利益率が下がったら");
  await page.getByRole("button", { name: "振り返り日を追加" }).click();
  await page
    .getByLabel("追加の振り返り日 1", { exact: true })
    .fill("2099-02-01");
  await page.getByRole("button", { name: "変更を保存" }).click();
  await expect(
    page.getByText("編集後の投資仮説", { exact: true }),
  ).toBeVisible();
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
  expect(edited.reviewDates).toHaveLength(2);
  expect(after.transactions).toEqual(before.transactions);
  expect(after.decisions).toHaveLength(before.decisions.length);
  await page.getByRole("link", { name: "編集", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "判断を編集", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "投資仮説", exact: true })
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
