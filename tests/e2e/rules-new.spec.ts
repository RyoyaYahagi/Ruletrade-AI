import { test, expect } from "@playwright/test";

test.describe("New Rule Creation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/rules/new");
    await expect(page.getByTestId("new-rule-form")).toBeVisible();
  });

  test("displays new rule form with all fields", async ({ page }) => {
    await expect(page.getByTestId("new-rule-ticker-input")).toBeVisible();
    await expect(page.getByTestId("new-rule-company-name-input")).toBeVisible();
    await expect(page.getByTestId("new-rule-market-input")).toBeVisible();
    await expect(page.getByTestId("new-rule-currency-select")).toBeVisible();
    await expect(page.getByTestId("new-rule-submit-button")).toBeVisible();
  });

  test("validates required ticker field", async ({ page }) => {
    const tickerInput = page.getByTestId("new-rule-ticker-input");
    await expect(tickerInput).toHaveAttribute("required", "");
  });

  test("submit button is disabled when ticker is empty", async ({ page }) => {
    const submitButton = page.getByTestId("new-rule-submit-button");
    await expect(submitButton).toBeDisabled();
  });

  test("user can fill form and create a rule session", async ({ page }) => {
    await page.getByTestId("new-rule-ticker-input").fill("6758");
    await page.getByTestId("new-rule-company-name-input").fill("ソニーグループ");
    await page.getByTestId("new-rule-market-input").fill("TSE");
    await page.getByTestId("new-rule-currency-select").selectOption("JPY");

    await page.getByTestId("new-rule-submit-button").click();

    // Wait for navigation to the new session page
    await page.waitForURL(/.*rules\/.+/, { timeout: 10000 });
    await expect(page).toHaveURL(/.*rules\/.+/);
  });
});
