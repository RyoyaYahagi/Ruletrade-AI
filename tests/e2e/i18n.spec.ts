import { expect, test } from "@playwright/test";

test("言語切替UIが表示される", async ({ page }) => {
  await page.goto("/settings/accessibility");
  await expect(page.locator("text=Accessibility Settings")).toBeVisible();
});
