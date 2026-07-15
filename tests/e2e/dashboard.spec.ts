import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    // E2E_TEST_AUTH configures deterministic server-side auth.
    await page.goto("/dashboard");
  });

  test("displays dashboard with title and workbench", async ({ page }) => {
    await expect(page.getByTestId("dashboard-workbench")).toBeVisible();

    await expect(
      page.getByRole("heading", {
        name: "AIと一緒に投資ルールを作成・レビューする",
      }),
    ).toBeVisible();
  });

  test("has New rule button", async ({ page }) => {
    await expect(page.getByTestId("dashboard-new-rule-button")).toBeVisible();
  });

  test("has portfolio link", async ({ page }) => {
    await expect(page.getByTestId("dashboard-portfolio-link")).toBeVisible();
    await expect(page.getByTestId("dashboard-portfolio-link")).toContainText(
      "ポートフォリオ",
    );
  });

  test("navigates to portfolio from dashboard", async ({ page }) => {
    await page.getByTestId("dashboard-portfolio-link").click();
    await expect(page).toHaveURL(/.*portfolio/);
    await expect(page.getByTestId("portfolio-page")).toBeVisible();
  });

  test("navigates to new rule page from dashboard", async ({ page }) => {
    await page.getByTestId("dashboard-new-rule-button").click();
    await expect(page).toHaveURL(/.*rules\/new/);
    await expect(page.getByTestId("new-rule-form")).toBeVisible();
  });
});
