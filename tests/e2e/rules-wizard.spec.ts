import { expect, test } from "@playwright/test";

test("新規セッションを10問のルール質問で完了直前まで進められる", async ({
  page,
}) => {
  await page.goto("/rules/new");
  await page.getByTestId("new-rule-ticker-input").fill("9984");
  await page.getByTestId("new-rule-company-name-input").fill("テスト銘柄");
  await page.getByTestId("new-rule-market-input").fill("TSE");
  await page.getByTestId("new-rule-submit-button").click();
  await page.waitForURL(/.*rules\/.+/, { timeout: 10000 });

  for (let questionNumber = 0; questionNumber < 10; questionNumber += 1) {
    const questionHeading = page.locator("form h2").first();
    await expect(questionHeading).toBeVisible();
    const questionText = await questionHeading.innerText();

    if (questionText.includes("投資仮説")) {
      await expect(page.locator("form textarea")).toHaveValue(/事業の成長/);
      await page.locator("form textarea").fill("私は事業の成長を観測する。");
      await page.getByRole("button", { name: "回答を保存" }).click();
    } else {
      await page.getByRole("button", { name: "まだ決めていない" }).click();
      await page.getByRole("button", { name: "この設定を使う" }).click();
    }

    if (questionNumber < 9) {
      await expect(page.locator("form h2").first()).not.toHaveText(questionText);
    }
  }

  await expect(
    page.getByRole("heading", { name: "質問はすべて回答済みです" }),
  ).toBeVisible();
});
