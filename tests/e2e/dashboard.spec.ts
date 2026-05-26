import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    // .env.test configures mock auth, so user is authenticated
    await page.goto("/dashboard");
  });

  test("displays dashboard with title and workbench", async ({ page }) => {
    await expect(page.getByTestId("dashboard-workbench")).toBeVisible();

    await expect(
      page.getByRole("heading", { name: "AIと一緒に投資ルールを作成・レビューする" })
    ).toBeVisible();
  });

  test("has New rule button", async ({ page }) => {
    await expect(page.getByTestId("dashboard-new-rule-button")).toBeVisible();
    await expect(page.getByTestId("dashboard-new-rule-button")).toContainText("New rule");
  });

  test("navigates to new rule page from dashboard", async ({ page }) => {
    await page.getByTestId("dashboard-new-rule-button").click();
    await expect(page).toHaveURL(/.*rules\/new/);
    await expect(page.getByTestId("new-rule-form")).toBeVisible();
  });
});
