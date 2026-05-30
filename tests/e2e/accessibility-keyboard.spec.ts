import { expect, test } from "@playwright/test";

test("サイトにアクセスできる", async ({ page }) => {
  await page.goto("/settings/accessibility");
  await expect(page.locator("text=Accessibility Settings")).toBeVisible();
});
