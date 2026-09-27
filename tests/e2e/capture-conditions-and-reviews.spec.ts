import { expect, test } from "@playwright/test";

test("preserves line breaks in condition fields and saves multiple review dates", async ({
  page,
}) => {
  await page.route("**/api/decisions/extract", (route) =>
    route.fulfill({
      json: {
        type: "note",
        stock: { name: "架空複数予定社", ticker: null, market: null },
        thesis: "複数の時期で振り返る",
        assumptions: [],
        reviewConditions: [],
        addConditions: [],
        transaction: null,
        followUpQuestion: null,
      },
    }),
  );
  await page.goto("/");
  await page
    .getByLabel("テキストで入力する")
    .fill("需要を継続して観察したい。");
  await page.getByRole("button", { name: "内容を整理する" }).click();
  for (const label of [
    "前提（1行に1つ）",
    "見直し条件（1行に1つ）",
    "買い増し条件（1行に1つ）",
  ]) {
    const field = page.getByLabel(label);
    await field.fill("最初の条件");
    await field.press("End");
    await field.press("Enter");
    await expect(field).toHaveValue("最初の条件\n");
    await field.pressSequentially("次の条件");
    await expect(field).toHaveValue("最初の条件\n次の条件");
  }
  await page.getByRole("button", { name: "1か月後", exact: true }).click();
  await page.getByRole("button", { name: "3か月後", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "1か月後", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "3か月後", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "日付指定", exact: true }).click();
  await page.getByRole("button", { name: "この内容で保存" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "振り返り日を入力してください。",
  );
  await page.getByLabel("振り返り日", { exact: true }).fill("2025-01-01");
  await page.getByRole("button", { name: "振り返り日を追加" }).click();
  await page
    .getByLabel("追加の振り返り日 1", { exact: true })
    .fill("2025-02-01");
  await page.getByRole("button", { name: "振り返り日を追加" }).click();
  await page
    .getByRole("button", { name: "追加の振り返り日 2を削除", exact: true })
    .click();
  await page.getByRole("button", { name: "次の決算", exact: true }).click();
  await page.getByLabel("次の決算日").fill("2025-03-01");
  await page.getByRole("button", { name: "この内容で保存" }).click();
  await expect(page).toHaveURL(/\/stocks\//);
  const stockId = page.url().split("/").pop();
  const exported = await (await page.request.get("/api/export")).json();
  const decision = exported.decisions.find(
    (item: { stockId: string }) => item.stockId === stockId,
  );
  expect(decision.reviewConditions).toEqual(["最初の条件", "次の条件"]);
  expect(decision.addConditions).toEqual(["最初の条件", "次の条件"]);
  expect(decision.assumptions).toEqual(["最初の条件", "次の条件"]);
  expect(decision.reviewDates).toHaveLength(5);
  await expect(page.getByText(/振り返り予定:/)).toContainText("2025/1/1");
});
