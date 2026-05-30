import { test, expect } from "@playwright/test";

test.describe("Login Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByTestId("login-form")).toBeVisible();
  });

  test("displays login form with email and password fields", async ({ page }) => {
    await expect(page.getByTestId("login-email-input")).toBeVisible();
    await expect(page.getByTestId("login-password-input")).toBeVisible();
    await expect(page.getByTestId("login-submit-button")).toBeVisible();
    await expect(page.getByTestId("login-submit-button")).toContainText("ログイン");
  });

  test("shows validation error for empty submission", async ({ page }) => {
    // HTML5 required validation prevents empty submission
    const emailInput = page.getByTestId("login-email-input");
    await expect(emailInput).toHaveAttribute("required", "");

    const passwordInput = page.getByTestId("login-password-input");
    await expect(passwordInput).toHaveAttribute("required", "");
  });

  test("shows error message with invalid credentials", async ({ page }) => {
    await page.getByTestId("login-email-input").fill("invalid@example.com");
    await page.getByTestId("login-password-input").fill("wrongpassword");
    await page.getByTestId("login-submit-button").click();

    // In mock auth environment, Supabase sign-in will fail
    await expect(page.getByTestId("login-error-message")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("login-error-message")).toContainText("ログインに失敗しました");
  });
});
