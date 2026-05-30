import { test, expect } from "@playwright/test";

test.describe("Accessibility Settings Form", () => {
  test.beforeEach(async ({ page }) => {
    page.on("response", async (response) => {
      if (response.url().includes("/api/ui/preferences")) {
        const body = await response.text().catch(() => "[unable to read body]");
        console.log(`[API] ${response.request().method()} ${response.url()} => ${response.status()}: ${body.slice(0, 200)}`);
      }
    });

    await page.goto("/settings/accessibility");

    await expect(
      page.getByTestId("accessibility-settings-form")
    ).toBeVisible();
  });

  test("user can check and uncheck accessibility options", async ({ page }) => {
    const checkbox = page.getByTestId("accessibility-checkbox-reduced-motion");

    const initialChecked = await checkbox.isChecked();

    await checkbox.click();

    // Wait for save confirmation
    await expect(
      page.getByTestId("accessibility-message")
    ).toContainText("設定を保存しました", { timeout: 5000 });

    // Verify checkbox state changed
    await expect(checkbox).toBeChecked({ checked: !initialChecked });

    // Toggle back
    await checkbox.click();
    await expect(checkbox).toBeChecked({ checked: initialChecked });
  });

  test("high contrast checkbox can be toggled", async ({ page }) => {
    const checkbox = page.getByTestId("accessibility-checkbox-high-contrast");

    await checkbox.click();

    await expect(
      page.getByTestId("accessibility-message")
    ).toContainText("設定を保存しました", { timeout: 5000 });
  });
});
