import { expect, test } from "@playwright/test";

test("サイトにアクセスできる", async ({ page }) => {
  await page.goto("/settings/accessibility");
  await expect(page.getByTestId("accessibility-settings-page")).toBeVisible();
});
