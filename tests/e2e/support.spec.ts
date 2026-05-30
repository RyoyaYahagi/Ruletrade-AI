import { test, expect } from "@playwright/test";

test.describe("Support Ticket Creation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/support");
    await expect(page.getByTestId("support-form")).toBeVisible();
  });

  test("displays support form with all fields", async ({ page }) => {
    await expect(page.getByTestId("support-email-input")).toBeVisible();
    await expect(page.getByTestId("support-category-select")).toBeVisible();
    await expect(page.getByTestId("support-subject-input")).toBeVisible();
    await expect(page.getByTestId("support-body-textarea")).toBeVisible();
    await expect(page.getByTestId("support-submit-button")).toBeVisible();
    await expect(page.getByTestId("support-submit-button")).toContainText("送信");
  });

  test("validates required fields", async ({ page }) => {
    await expect(page.getByTestId("support-email-input")).toHaveAttribute("required", "");
    await expect(page.getByTestId("support-subject-input")).toHaveAttribute("required", "");
    await expect(page.getByTestId("support-body-textarea")).toHaveAttribute("required", "");
  });

  test("user can submit a support ticket", async ({ page }) => {
    await page.getByTestId("support-email-input").fill("test@example.com");
    await page.getByTestId("support-category-select").selectOption("bug");
    await page.getByTestId("support-subject-input").fill("E2Eテスト：不具合報告");
    await page.getByTestId("support-body-textarea").fill("これはE2Eテストからの送信です。");

    await page.getByTestId("support-submit-button").click();

    // Wait for success message
    await expect(page.getByTestId("support-message")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("support-message")).toContainText("お問い合わせを受け付けました");
  });
});
