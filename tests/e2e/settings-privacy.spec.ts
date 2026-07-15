import { test, expect } from "@playwright/test";

test.describe("Privacy Settings Form", () => {
  test.beforeEach(async ({ page }) => {
    // Capture API responses for debugging
    page.on("response", async (response) => {
      if (response.url().includes("/api/privacy/settings")) {
        const body = await response.text().catch(() => "[unable to read body]");
        console.log(`[API] ${response.request().method()} ${response.url()} => ${response.status()}: ${body}`);
      }
    });

    // Go to privacy settings (mock auth is configured in .env.test)
    await page.goto("/settings/privacy");

    // Wait for the form to load
    await expect(
      page.getByTestId("privacy-settings-form")
    ).toBeVisible();
  });

  test("user can toggle privacy settings and see save confirmation", async ({ page }) => {
    const toggle = page.getByTestId("privacy-toggle-aiMemoryEnabled");

    // Click toggle
    await toggle.click();

    // Wait for save confirmation message
    await expect(
      page.getByTestId("privacy-message")
    ).toContainText("設定を更新しました", { timeout: 5000 });

    // Toggle again to revert
    await toggle.click();

    await expect(
      page.getByTestId("privacy-message")
    ).toContainText("設定を更新しました", { timeout: 5000 });
  });

  test("toggling allowRagIndexing updates state correctly", async ({ page }) => {
    const toggle = page.getByTestId("privacy-toggle-allowRagIndexing");

    // aria-pressed should reflect the toggle state
    const initialState = await toggle.getAttribute("aria-pressed");

    await toggle.click();

    // Wait for network idle to ensure request completed
    await page.waitForResponse((resp) =>
      resp.url().includes("/api/privacy/settings") && resp.request().method() === "PATCH"
    );

    const newState = await toggle.getAttribute("aria-pressed");
    expect(newState).not.toBe(initialState);
  });
});
