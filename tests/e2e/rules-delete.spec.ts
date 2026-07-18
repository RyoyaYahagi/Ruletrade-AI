import { expect, test } from "@playwright/test";

test("ルール詳細画面から銘柄別ルールを削除できる", async ({ page }) => {
  await page.goto("/rules/new");
  await page.getByTestId("new-rule-ticker-input").fill("6758");
  await page.getByTestId("new-rule-company-name-input").fill("削除テスト銘柄");
  await page.getByTestId("new-rule-market-input").fill("TSE");
  await page.getByTestId("new-rule-submit-button").click();
  await page.waitForURL(/.*rules\/.+/, { timeout: 10000 });
  await expect(
    page.getByRole("button", { name: "ルールを削除" }),
  ).toBeVisible();

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "ルールを削除" }).click();

  await expect(page).toHaveURL(/.*rules$/);
  await expect(page.getByTestId("rules-page")).toBeVisible();
  await expect(page.getByText("削除テスト銘柄 (6758)")).not.toBeVisible();
});
