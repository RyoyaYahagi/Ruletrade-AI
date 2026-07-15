import { expect, test } from "@playwright/test";

test("設定画面がロケールに依存せず表示される", async ({ page }) => {
  await page.goto("/settings/accessibility");
  await expect(page.getByTestId("accessibility-page-title")).toBeVisible();
});
