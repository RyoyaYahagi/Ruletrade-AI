import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test("displays the top page with title and CTA buttons", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /投資ルールを整理し/ })
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: "ログイン" })
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: "新規登録" })
    ).toBeVisible();
  });

  test("navigates to login page from CTA", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "ログイン" }).click();
    await expect(page).toHaveURL(/.*login/);
  });
});
